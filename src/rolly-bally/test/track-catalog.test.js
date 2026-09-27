import { describe, it, expect } from 'vitest';
import { PIECES, PIECE_IDS, getPiece, buildPieceDef, piecesForLevel, resolveOptions } from '../src/track/Catalog.js';
import { TrackLayout, STRIP_STEP } from '../src/track/TrackLayout.js';
import { START_PAD_WIDTH } from '../src/track/pieces/start.js';
import { forwardXZ, rightXZ } from '../src/track/math.js';

const WIDTHS = [3, 4, 5, 6, 8];
const PLAN_PIECES = [
  'straight', 'curve-gentle-left', 'curve-gentle-right', 'curve-sharp-left', 'curve-sharp-right',
  'ramp-up', 'ramp-down', 'launch', 'gap-bridged', 'gap-open', 'beam', 'start', 'finish',
  'checkpoint', 'boost', 'bumpers', 'hammer', 'wrecking-ball', 'spinner', 'moving-platform',
];

/** Closed-form exit of a piece built at the origin (exact circle arcs). */
function analyticExit(def) {
  let x = 0;
  let y = 0;
  let z = 0;
  let yaw = 0;
  for (const sec of def.sections) {
    const turn = sec.turn || 0;
    const f = forwardXZ(yaw);
    const r = rightXZ(yaw);
    let fwd = sec.len;
    let left = 0;
    if (Math.abs(turn) > 1e-9) {
      const R = sec.len / turn;
      fwd = R * Math.sin(turn);
      left = R * (1 - Math.cos(turn));
    }
    x += f.x * fwd - r.x * left;
    z += f.z * fwd - r.z * left;
    y += sec.rise || 0;
    yaw += turn;
  }
  return { x, y, z, yaw };
}

describe('track catalog', () => {
  it('has every v1 piece from the plan, with unique ids', () => {
    expect(new Set(PIECE_IDS).size).toBe(PIECE_IDS.length);
    for (const id of PLAN_PIECES) expect(PIECE_IDS).toContain(id);
    for (const p of PIECES) {
      expect(typeof p.name).toBe('string');
      expect(p.minLevel).toBeGreaterThanOrEqual(1);
      expect(p.minLevel).toBeLessThanOrEqual(5);
    }
  });

  it('level allow-lists grow with difficulty', () => {
    expect(piecesForLevel(1).some((p) => p.hazard || p.gap)).toBe(false);
    for (let l = 2; l <= 5; l++) expect(piecesForLevel(l).length).toBeGreaterThanOrEqual(piecesForLevel(l - 1).length);
    expect(piecesForLevel(5).length).toBe(PIECES.length);
    expect(() => getPiece('nope')).toThrow();
  });

  it('resolves options', () => {
    expect(resolveOptions({ rails: true }).rails).toBe('full');
    expect(resolveOptions({ rails: false }).rails).toBe('none');
    expect(resolveOptions({ rails: 'weird' }).rails).toBe('full');
    expect(resolveOptions({}).width).toBe(8);
  });

  for (const id of PIECE_IDS) {
    describe(id, () => {
      for (const width of WIDTHS) {
        it(`width ${width}: sections, features and exit are valid`, () => {
          const opts = { width, rails: 'full' };
          const def = buildPieceDef(id, opts);
          expect(def.sections.length).toBeGreaterThan(0);
          const layout = new TrackLayout([id], opts);
          const piece = layout.pieces[0];
          const len = piece.s1 - piece.s0;
          expect(len).toBeGreaterThan(2);

          // Exit matches the closed-form arc composition.
          const ex = analyticExit(def);
          expect(piece.exit.x).toBeCloseTo(ex.x, 6);
          expect(piece.exit.y).toBeCloseTo(ex.y, 6);
          expect(piece.exit.z).toBeCloseTo(ex.z, 6);
          expect(piece.exit.yaw).toBeCloseTo(ex.yaw, 9);

          // Widths: pieces start and end at the track width (the start pad starts wide).
          const first = layout.strips[0];
          const last = layout.strips[layout.strips.length - 1];
          expect(first.widthA).toBeCloseTo(id === 'start' ? Math.max(width, START_PAD_WIDTH) : width, 9);
          expect(last.widthB).toBeCloseTo(width, 9);
          for (const st of layout.strips) {
            expect(st.widthA).toBeGreaterThanOrEqual(Math.min(width, 1.6) - 1e-9);
            expect(st.widthA).toBeLessThanOrEqual(Math.max(width + 2, START_PAD_WIDTH) + 1e-9);
            expect(st.hlen).toBeLessThanOrEqual(STRIP_STEP + 1e-9);
          }

          // Features sit on the piece and inside the road.
          for (const f of def.features) {
            expect(f.s).toBeGreaterThanOrEqual(0);
            expect(f.s).toBeLessThanOrEqual(len + 1e-6);
            if (f.lateral !== undefined) expect(Math.abs(f.lateral)).toBeLessThan(layout.spline.widthAt(piece.s0 + f.s) / 2);
            for (const slot of f.slots || []) expect(Math.abs(slot.lateral)).toBeLessThan(layout.spline.widthAt(piece.s0 + slot.s) / 2 - 0.5);
          }
          for (const l of def.lanes) {
            expect(l.s0).toBeLessThanOrEqual(l.s1);
            expect(l.min).toBeLessThanOrEqual(l.max + 1e-9);
          }
        });
      }
    });
  }

  it('rails follow the rails option', () => {
    const list = ['start', 'straight', 'curve-sharp-left', 'beam', 'gap-bridged', 'finish'];
    const full = new TrackLayout(list, { width: 6, rails: 'full' });
    const curves = new TrackLayout(list, { width: 6, rails: 'curves' });
    const none = new TrackLayout(list, { width: 6, rails: 'none' });
    const finishIdx = list.indexOf('finish');
    const beamIdx = list.indexOf('beam');
    for (const st of full.strips) {
      if (st.piece === beamIdx || !st.floor) expect(st.rails).toBe(false);
    }
    expect(full.strips.filter((s) => s.piece === 1).every((s) => s.rails)).toBe(true);
    for (const st of curves.strips) {
      if (st.piece === finishIdx) expect(st.rails).toBe(true);
      else expect(st.rails).toBe(Math.abs(st.yawB - st.yawA) > 1e-9);
    }
    for (const st of none.strips) expect(st.rails).toBe(st.piece === finishIdx);
  });
});
