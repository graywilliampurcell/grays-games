// Playground "wedged ball" rescue: if the child keeps steering but the ball
// hasn't moved more than STUCK_DIST in STUCK_TIME seconds (stuck in a valley,
// a tunnel mouth, between a tree and a wall...), report it so the mode can
// fade and respawn at the nearest safe pad. Same idea as Race's stuckTime.
// Pure (no three.js): positions are plain {x, y, z}.

export const STUCK_TIME = 5; // s of steering without real movement
export const STUCK_DIST = 0.5; // m the ball must move to count as "not stuck"

export class StuckWatch {
  constructor({ time = STUCK_TIME, dist = STUCK_DIST } = {}) {
    this.time = time;
    this.dist = dist;
    this.anchor = null;
    this.t = 0;
  }

  /** Forget the anchor (call after a respawn). */
  reset() {
    this.anchor = null;
    this.t = 0;
  }

  /**
   * @param {number} dt
   * @param {{x:number, y:number, z:number}} pos ball position
   * @param {boolean} steering the player is pushing the stick/keys
   * @returns {boolean} true once when the ball counts as stuck (then resets)
   */
  update(dt, pos, steering) {
    if (!this.anchor) {
      this.anchor = { x: pos.x, y: pos.y, z: pos.z };
      this.t = 0;
      return false;
    }
    const a = this.anchor;
    if (Math.hypot(pos.x - a.x, pos.y - a.y, pos.z - a.z) > this.dist) {
      a.x = pos.x;
      a.y = pos.y;
      a.z = pos.z;
      this.t = 0;
      return false;
    }
    // Only time spent trying to move counts: resting on purpose is fine.
    if (steering) this.t += dt;
    if (this.t >= this.time) {
      this.reset();
      return true;
    }
    return false;
  }
}
