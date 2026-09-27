// Rapier wrapper. One Physics instance per running mode: the Game host
// creates it before mode.start() and calls dispose() after mode.dispose(),
// so modes never need to clean up bodies individually (they may, via remove()).
//
// Conventions: y is up, 1 unit = 1 m. Positions are {x,y,z} (THREE.Vector3
// works). Rotations are quaternions {x,y,z,w} (THREE.Quaternion works);
// helpers also accept a `yaw` number (radians about +Y) for convenience.

import RAPIER from '@dimforge/rapier3d-compat';

let rapierReady = null;

/** Load Rapier's WASM once. Safe to call repeatedly. */
export function initRapier() {
  if (!rapierReady) rapierReady = RAPIER.init().then(() => RAPIER);
  return rapierReady;
}

export { RAPIER };

export const GRAVITY = -20; // a bit stronger than real: snappier, less floaty

function toQuat(opts) {
  if (opts.rotation) return opts.rotation;
  if (opts.yaw) return { x: 0, y: Math.sin(opts.yaw / 2), z: 0, w: Math.cos(opts.yaw / 2) };
  return { x: 0, y: 0, z: 0, w: 1 };
}

function applyMaterial(desc, opts) {
  if (opts.friction !== undefined) desc.setFriction(opts.friction);
  if (opts.restitution !== undefined) desc.setRestitution(opts.restitution);
  if (opts.sensor) desc.setSensor(true);
  if (opts.sensor || opts.events) desc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
  return desc;
}

export class Physics {
  /** Call `await initRapier()` first (main.js does this behind the loader). */
  constructor({ gravity = GRAVITY } = {}) {
    this.RAPIER = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: gravity, z: 0 });
    this.world.timestep = 1 / 60;
    this.eventQueue = new RAPIER.EventQueue(true);
    // collider handle -> { tag, data, onCollide }
    this.registry = new Map();
    this.bodies = new Set();
    this.disposed = false;
  }

  // ---------------------------------------------------------------- stepping

  /** Advance one fixed step and dispatch collision/sensor callbacks. */
  step(dt = 1 / 60) {
    this.world.timestep = dt;
    this.world.step(this.eventQueue);
    this.eventQueue.drainCollisionEvents((h1, h2, started) => {
      const a = this.registry.get(h1);
      const b = this.registry.get(h2);
      const c1 = this.world.getCollider(h1);
      const c2 = this.world.getCollider(h2);
      if (!c1 || !c2) return;
      if (a && a.onCollide) a.onCollide({ self: c1, other: c2, otherInfo: b || null, started });
      if (b && b.onCollide) b.onCollide({ self: c2, other: c1, otherInfo: a || null, started });
    });
  }

  // ---------------------------------------------------------------- registry

  /**
   * Attach metadata to a collider: tag (string, e.g. 'track', 'hazard',
   * 'boost', 'star'), data (anything), onCollide({self, other, otherInfo, started}).
   * onCollide needs the collider to have been created with sensor or events: true.
   */
  register(collider, { tag = null, data = null, onCollide = null } = {}) {
    this.registry.set(collider.handle, { tag, data, onCollide });
    return collider;
  }

  /** Metadata registered for a collider (or null). */
  info(collider) {
    return (collider && this.registry.get(collider.handle)) || null;
  }

  _body(desc) {
    const body = this.world.createRigidBody(desc);
    this.bodies.add(body);
    return body;
  }

  _collider(desc, body, opts) {
    const collider = this.world.createCollider(desc, body);
    if (opts.tag || opts.data || opts.onCollide) this.register(collider, opts);
    return collider;
  }

  // ---------------------------------------------------------------- statics

  /**
   * Fixed box. opts: position, halfExtents {x,y,z}, rotation|yaw, friction,
   * restitution, sensor, events, tag, data, onCollide. Returns {body, collider}.
   */
  addFixedCuboid(opts) {
    const p = opts.position;
    const h = opts.halfExtents;
    const body = this._body(RAPIER.RigidBodyDesc.fixed().setTranslation(p.x, p.y, p.z).setRotation(toQuat(opts)));
    const desc = applyMaterial(RAPIER.ColliderDesc.cuboid(h.x, h.y, h.z), opts);
    return { body, collider: this._collider(desc, body, opts) };
  }

  /**
   * Fixed triangle mesh. vertices: Float32Array [x,y,z,...] (or number[]),
   * indices: Uint32Array (or number[]). Optional position/rotation of the body.
   * Winding: counter-clockwise seen from the solid side's outside (three.js default).
   */
  addFixedTrimesh(vertices, indices, opts = {}) {
    const p = opts.position || { x: 0, y: 0, z: 0 };
    const body = this._body(RAPIER.RigidBodyDesc.fixed().setTranslation(p.x, p.y, p.z).setRotation(toQuat(opts)));
    const desc = applyMaterial(
      RAPIER.ColliderDesc.trimesh(
        vertices instanceof Float32Array ? vertices : new Float32Array(vertices),
        indices instanceof Uint32Array ? indices : new Uint32Array(indices),
        RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES,
      ),
      opts,
    );
    return { body, collider: this._collider(desc, body, opts) };
  }

  /**
   * Fixed heightfield terrain.
   * nx, nz: number of cells along x and z (heights has (nx+1)*(nz+1) samples).
   * heights: Float32Array indexed heights[ix * (nz + 1) + iz]  (x-major; this is
   *   Rapier's column-major layout with rows along z).
   * sizeX, sizeZ: world extent; the field is centered on `position` (x,z) and
   *   heights are added to position.y.
   */
  addHeightfield({ nx, nz, heights, sizeX, sizeZ, position = { x: 0, y: 0, z: 0 }, ...opts }) {
    const body = this._body(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z));
    const desc = applyMaterial(
      RAPIER.ColliderDesc.heightfield(nz, nx, heights, { x: sizeX, y: 1, z: sizeZ }, RAPIER.HeightFieldFlags.FIX_INTERNAL_EDGES),
      opts,
    );
    return { body, collider: this._collider(desc, body, opts) };
  }

  /** Sensor box (no collision response). onCollide fires on enter (started=true) / exit. */
  addSensorCuboid(opts) {
    return this.addFixedCuboid({ ...opts, sensor: true });
  }

  // ---------------------------------------------------------------- moving

  /**
   * Kinematic position-based body (hammers, spinners, moving platforms).
   * opts: position, rotation|yaw, shapes: [{type:'cuboid', halfExtents, offset?, rotation?}
   *   | {type:'ball', radius, offset?} | {type:'cylinder', halfHeight, radius, offset?, rotation?}],
   * plus friction/restitution/tag/data/onCollide/events applied to every shape.
   * Move it each update with body.setNextKinematicTranslation / setNextKinematicRotation.
   * Returns {body, colliders}.
   */
  addKinematic(opts) {
    const p = opts.position || { x: 0, y: 0, z: 0 };
    const body = this._body(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y, p.z).setRotation(toQuat(opts)),
    );
    const colliders = (opts.shapes || []).map((s) => {
      let desc;
      if (s.type === 'ball') desc = RAPIER.ColliderDesc.ball(s.radius);
      else if (s.type === 'cylinder') desc = RAPIER.ColliderDesc.cylinder(s.halfHeight, s.radius);
      else desc = RAPIER.ColliderDesc.cuboid(s.halfExtents.x, s.halfExtents.y, s.halfExtents.z);
      if (s.offset) desc.setTranslation(s.offset.x, s.offset.y, s.offset.z);
      if (s.rotation) desc.setRotation(s.rotation);
      applyMaterial(desc, opts);
      return this._collider(desc, body, opts);
    });
    return { body, colliders };
  }

  /**
   * Dynamic sphere. opts: position, radius, mass, friction, restitution,
   * linearDamping, angularDamping, ccd, tag, data. Returns {body, collider}.
   */
  addDynamicBall(opts) {
    const p = opts.position;
    const body = this._body(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(p.x, p.y, p.z)
        .setLinearDamping(opts.linearDamping ?? 0)
        .setAngularDamping(opts.angularDamping ?? 0)
        .setCcdEnabled(opts.ccd ?? true)
        .setCanSleep(false),
    );
    const desc = applyMaterial(RAPIER.ColliderDesc.ball(opts.radius), opts);
    desc.setMass(opts.mass ?? 1);
    if (opts.events) desc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    return { body, collider: this._collider(desc, body, opts) };
  }

  // ---------------------------------------------------------------- queries

  /**
   * Cast a ray. Returns {collider, toi, point:{x,y,z}, normal:{x,y,z}} or null.
   * opts: solid (default true), excludeBody, excludeSensors (default true).
   */
  raycast(origin, dir, maxDist, { solid = true, excludeBody = null, excludeSensors = true } = {}) {
    const ray = new RAPIER.Ray(origin, dir);
    const flags = excludeSensors ? RAPIER.QueryFilterFlags.EXCLUDE_SENSORS : undefined;
    const hit = this.world.castRayAndGetNormal(ray, maxDist, solid, flags, undefined, undefined, excludeBody || undefined);
    if (!hit) return null;
    const t = hit.timeOfImpact;
    return {
      collider: hit.collider,
      toi: t,
      point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t },
      normal: { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z },
    };
  }

  // ---------------------------------------------------------------- cleanup

  /** Remove a body and all its colliders. */
  remove(body) {
    if (!body || this.disposed) return;
    for (let i = 0; i < body.numColliders(); i++) this.registry.delete(body.collider(i).handle);
    this.bodies.delete(body);
    this.world.removeRigidBody(body);
  }

  /** Free the whole world (called by the Game host after mode.dispose()). */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.registry.clear();
    this.bodies.clear();
    this.eventQueue.free();
    this.world.free();
  }
}
