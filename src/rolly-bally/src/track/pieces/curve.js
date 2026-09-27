// Curves: constant-radius turns. Gentle = 45° over 20 m (radius ≈ 25 m),
// sharp = 90° over 16 m (radius ≈ 10 m). Positive turn = left.
// Params: len, angle (degrees, overrides the default size).

import { deg } from '../math.js';

function makeCurve(id, name, angleDeg, len, dir) {
  return {
    id,
    name,
    kind: 'curve',
    build(o) {
      const a = deg(o.angle ?? angleDeg);
      return { sections: [{ len: o.len ?? len, turn: dir * a }] };
    },
  };
}

export const curveGentleLeft = makeCurve('curve-gentle-left', 'Gentle curve left', 45, 20, 1);
export const curveGentleRight = makeCurve('curve-gentle-right', 'Gentle curve right', 45, 20, -1);
export const curveSharpLeft = makeCurve('curve-sharp-left', 'Sharp curve left', 90, 16, 1);
export const curveSharpRight = makeCurve('curve-sharp-right', 'Sharp curve right', 90, 16, -1);
