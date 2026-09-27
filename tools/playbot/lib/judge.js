// Vision/LLM judge: judge({ prompt, images, schema }) -> parsed JSON matching `schema`.
// Providers: "claude-code" (headless `claude -p`, reads images with its Read tool)
//            "anthropic-api" (Messages API via fetch, ANTHROPIC_API_KEY, base64 images).
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';

const MEDIA = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };

export async function judge({ prompt, images = [], schema, provider, model, config = {}, timeoutMs = 300000 }) {
  provider ??= config.judge?.provider ?? 'claude-code';
  model ??= config.judge?.model ?? 'claude-sonnet-5';
  const absImages = images.map((p) => resolve(p));
  const call = provider === 'anthropic-api' ? callApi : provider === 'claude-code' ? callClaudeCode : null;
  if (!call) throw new Error(`Unknown judge provider "${provider}"`);

  let lastError;
  let fullPrompt = buildPrompt(prompt, absImages, schema, provider);
  for (let attempt = 1; attempt <= 2; attempt++) {
    const raw = await call({ prompt: fullPrompt, images: absImages, model, timeoutMs });
    try {
      const value = extractJson(raw.text);
      const problems = validate(value, schema);
      if (problems.length) throw new Error(`schema mismatch: ${problems.join('; ')}`);
      return { value, provider, model, attempts: attempt, usage: raw.usage, costUsd: raw.costUsd };
    } catch (err) {
      lastError = new Error(`judge attempt ${attempt} returned bad JSON (${err.message}): ${String(raw.text).slice(0, 500)}`);
      fullPrompt = buildPrompt(prompt, absImages, schema, provider) +
        `\n\nYour previous answer was invalid (${err.message}). Reply again with ONLY the JSON object.`;
    }
  }
  throw lastError;
}

function buildPrompt(prompt, images, schema, provider) {
  const parts = [prompt.trim()];
  if (images.length && provider === 'claude-code') {
    parts.push(`Look at these image files using the Read tool (read every one before answering):\n${images.map((p) => `- ${p}`).join('\n')}`);
  }
  parts.push(
    'Answer with ONLY a single JSON object (no prose, no markdown code fences) that matches this JSON Schema:\n' +
      JSON.stringify(schema, null, 2),
  );
  return parts.join('\n\n');
}

function callClaudeCode({ prompt, images, model, timeoutMs }) {
  const dirs = [...new Set(images.map((p) => dirname(p)))];
  const args = ['-p', '--output-format', 'json', '--model', model, '--allowedTools', 'Read'];
  for (const d of dirs) args.push('--add-dir', d);
  return new Promise((resolvePromise, reject) => {
    const child = spawn('claude', args, { cwd: dirs[0] ?? process.cwd(), stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error(`claude -p timed out after ${timeoutMs}ms`)); }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      let envelope;
      try { envelope = JSON.parse(out); } catch {
        return reject(new Error(`claude -p exited ${code}; unparseable output: ${out.slice(0, 500)} ${err.slice(0, 500)}`));
      }
      if (envelope.is_error) return reject(new Error(`claude -p error: ${envelope.result ?? JSON.stringify(envelope).slice(0, 500)}`));
      resolvePromise({ text: envelope.result ?? '', usage: envelope.usage, costUsd: envelope.total_cost_usd });
    });
    child.stdin.end(prompt);
  });
}

async function callApi({ prompt, images, model, timeoutMs }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set (needed for judge provider anthropic-api)');
  const content = images.map((p) => ({
    type: 'image',
    source: { type: 'base64', media_type: MEDIA[extname(p).toLowerCase()] ?? 'image/png', data: readFileSync(p).toString('base64') },
  }));
  content.push({ type: 'text', text: prompt });
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 4096, messages: [{ role: 'user', content }] }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${JSON.stringify(body).slice(0, 500)}`);
  const text = body.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
  return { text, usage: body.usage };
}

/** Pull the JSON object out of a model reply (tolerates code fences / stray prose). */
export function extractJson(text) {
  const s = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(s); } catch {}
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(s.slice(start, end + 1));
  throw new Error('no JSON object found');
}

/** Minimal JSON Schema check: type, properties, required, items, enum, additionalProperties:false. */
export function validate(value, schema, path = '$') {
  if (!schema) return [];
  const problems = [];
  const types = [].concat(schema.type ?? []);
  if (types.length && !types.some((t) => isType(value, t))) {
    return [`${path}: expected ${types.join('|')}, got ${Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value}`];
  }
  if (schema.enum && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) {
    problems.push(`${path}: not one of ${JSON.stringify(schema.enum)}`);
  }
  if (isType(value, 'object')) {
    for (const k of schema.required ?? []) if (!(k in value)) problems.push(`${path}.${k}: missing`);
    for (const [k, sub] of Object.entries(schema.properties ?? {})) {
      if (k in value) problems.push(...validate(value[k], sub, `${path}.${k}`));
    }
    if (schema.additionalProperties === false) {
      for (const k of Object.keys(value)) if (!(k in (schema.properties ?? {}))) problems.push(`${path}.${k}: not allowed`);
    }
  }
  if (Array.isArray(value) && schema.items) value.forEach((v, i) => problems.push(...validate(v, schema.items, `${path}[${i}]`)));
  return problems;
}

function isType(v, t) {
  switch (t) {
    case 'object': return v !== null && typeof v === 'object' && !Array.isArray(v);
    case 'array': return Array.isArray(v);
    case 'integer': return Number.isInteger(v);
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'null': return v === null;
    default: return typeof v === t;
  }
}
