// Track piece catalog: every v1 piece by id, plus metadata the generator uses.
//
// A piece module's default export (or named export for mirrored families) is
//   { id, name, kind, hazard?, gap?, build(o) → PieceDef }
// where o = resolved options {width, rails, hazardSpeed, ...per-piece params}
// and PieceDef (all in the piece's own frame, s = meters from the piece start):
//   sections: [{ len,              horizontal length (m)
//                turn?,            heading change (radians, + = left)
//                rise?, profile?,  height change + 'linear'|'smooth'|'kick'
//                startSlope?,      (instead of profile) parabolic arc starting at this slope
//                width?, widthEnd?,floor width (default o.width), taper to widthEnd
//                rails?,           undefined = auto from o.rails, false = never, 'always'
//                floor?,           false = hole (gap); the center line keeps going
//                color?, edge? }]  palette key; edge trim on/off
//   features: [{type, s, ...}]    checkpoint | finish | start | startLine | boost |
//                                 bumper | hazard | wall | gapMarker
//   lanes:    [{s0, s1, min, max}] AI safe lateral range overrides (m, + = right)
//
// Levels: `minLevel` is the first difficulty the plan (§3.5) allows the piece at.

import straight from './pieces/straight.js';
import { curveGentleLeft, curveGentleRight, curveSharpLeft, curveSharpRight } from './pieces/curve.js';
import { rampUp, rampDown } from './pieces/ramp.js';
import launch from './pieces/launch.js';
import gapBridged from './pieces/gapBridged.js';
import gapOpen from './pieces/gapOpen.js';
import beam from './pieces/beam.js';
import start from './pieces/start.js';
import finish from './pieces/finish.js';
import checkpoint from './pieces/checkpoint.js';
import boost from './pieces/boost.js';
import bumpers from './pieces/bumpers.js';
import hammer from './pieces/hammer.js';
import wreckingBall from './pieces/wreckingBall.js';
import spinner from './pieces/spinner.js';
import movingPlatform from './pieces/movingPlatform.js';

const MIN_LEVEL = {
  start: 1,
  finish: 1,
  checkpoint: 1,
  straight: 1,
  'curve-gentle-left': 1,
  'curve-gentle-right': 1,
  'ramp-up': 1,
  'ramp-down': 1,
  'curve-sharp-left': 2,
  'curve-sharp-right': 2,
  bumpers: 2,
  'gap-bridged': 3,
  hammer: 3,
  boost: 3,
  'gap-open': 4,
  beam: 4,
  'wrecking-ball': 4,
  launch: 5,
  spinner: 5,
  'moving-platform': 5,
};

/** Every piece, in gallery order. */
export const PIECES = [
  start,
  straight,
  curveGentleLeft,
  curveGentleRight,
  curveSharpLeft,
  curveSharpRight,
  rampUp,
  rampDown,
  checkpoint,
  boost,
  bumpers,
  gapBridged,
  gapOpen,
  beam,
  launch,
  hammer,
  wreckingBall,
  spinner,
  movingPlatform,
  finish,
].map((p) => ({ hazard: false, gap: false, ...p, minLevel: MIN_LEVEL[p.id] ?? 1 }));

export const PIECE_IDS = PIECES.map((p) => p.id);

const BY_ID = new Map(PIECES.map((p) => [p.id, p]));

export function getPiece(id) {
  const p = BY_ID.get(id);
  if (!p) throw new Error(`Unknown track piece "${id}"`);
  return p;
}

export function hasPiece(id) {
  return BY_ID.has(id);
}

/** Pieces allowed at a difficulty level (1..5). */
export function piecesForLevel(level) {
  return PIECES.filter((p) => p.minLevel <= level);
}

/** Default track options; see resolveOptions. */
export const DEFAULT_TRACK_OPTIONS = {
  width: 8, // path width (m)
  rails: 'full', // 'full' | 'curves' | 'none' (or true/false)
  hazardSpeed: 1, // multiplies every moving hazard's speed
};

export function resolveOptions(opts = {}) {
  const o = { ...DEFAULT_TRACK_OPTIONS, ...opts };
  if (o.rails === true) o.rails = 'full';
  if (o.rails === false) o.rails = 'none';
  if (!['full', 'curves', 'none'].includes(o.rails)) o.rails = 'full';
  o.width = Math.max(1.5, Number(o.width) || DEFAULT_TRACK_OPTIONS.width);
  return o;
}

/**
 * Build one piece's definition.
 * @param {string|{id:string}} entry piece id or {id, ...params}
 * @param {object} opts track options (width, rails, hazardSpeed)
 */
export function buildPieceDef(entry, opts) {
  const e = typeof entry === 'string' ? { id: entry } : entry;
  const piece = getPiece(e.id);
  const o = { ...resolveOptions(opts), ...e };
  const def = piece.build(o);
  return {
    piece,
    params: e,
    options: o,
    sections: def.sections,
    features: def.features || [],
    lanes: def.lanes || [],
  };
}
