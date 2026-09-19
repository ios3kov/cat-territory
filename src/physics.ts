export const WIDTH = 360;
export const HEIGHT = 560;
export const LEFT_WALL = 32;
export const RIGHT_WALL = 328;
export const FLOOR_Y = 535;
export const DANGER_Y = 142;

export const TIER_DEFS = [
  {
    name: 'Sprout',
    radius: 15,
    base: '#43a9ff',
    accent: '#8dd7ff',
    shadow: '#2374d9',
  },
  {
    name: 'Peep',
    radius: 20,
    base: '#6ec64a',
    accent: '#b8eb78',
    shadow: '#3a9a3c',
  },
  {
    name: 'Puff',
    radius: 26,
    base: '#f36fb1',
    accent: '#ffabd3',
    shadow: '#cf438c',
  },
  {
    name: 'Bloop',
    radius: 33,
    base: '#f7cb3c',
    accent: '#fff18b',
    shadow: '#d99b24',
  },
  {
    name: 'Munch',
    radius: 41,
    base: '#f88738',
    accent: '#ffbd6d',
    shadow: '#d65a26',
  },
  {
    name: 'Beast',
    radius: 50,
    base: '#9d5bea',
    accent: '#cf98ff',
    shadow: '#7140c6',
  },
  {
    name: 'Cyclops',
    radius: 60,
    base: '#f05d55',
    accent: '#ff9a86',
    shadow: '#c43e45',
  },
  {
    name: 'Giant',
    radius: 72,
    base: '#4c8ff3',
    accent: '#8cc8ff',
    shadow: '#3264c4',
  },
  {
    name: 'Colossus',
    radius: 84,
    base: '#77bd45',
    accent: '#b9ec78',
    shadow: '#4a922f',
  },
] as const;

export const MAX_TIER = TIER_DEFS.length - 1;

export type Body = {
  id: number;
  tier: number;
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  angle: number;
  omega: number;
  impact: number;
  pressure: number;
  bornAt: number;
};

export type World = {
  bodies: Body[];
};

const GRAVITY = 1110;
const SOLVER_ITERATIONS = 6;
const AIR_DRAG = 0.99955;
const ANGULAR_DRAG = 0.999;
const CONTACT_FRICTION = 0.3;
const WALL_FRICTION = 0.2;
let nextBodyId = 1;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const massOf = (body: Body) => body.r * body.r;
const inverseMassOf = (body: Body) => 1 / massOf(body);
const inertiaOf = (body: Body) => 0.5 * massOf(body) * body.r * body.r;

export function spawnBody(
  tier: number,
  x: number,
  y: number,
  now: number
): Body {
  return {
    id: nextBodyId++,
    tier,
    x,
    y,
    r: TIER_DEFS[tier]!.radius,
    vx: 0,
    vy: 12,
    angle: 0,
    omega: 0,
    impact: 0,
    pressure: 0,
    bornAt: now,
  };
}

function resolveBoundary(
  body: Body,
  onImpact: (strength: number) => void,
  reportImpact: boolean
) {
  const sideRestitution = 0.17;
  const floorRestitution = 0.115;

  if (body.x - body.r < LEFT_WALL) {
    const incoming = -body.vx;
    body.x = LEFT_WALL + body.r;
    if (body.vx < 0) body.vx = -body.vx * sideRestitution;
    if (incoming > 60) {
      body.omega += incoming / Math.max(12, body.r) * 0.22;
      body.impact = Math.max(body.impact, Math.min(1, incoming / 520));
      if (reportImpact && incoming > 150) onImpact(incoming);
    }
  } else if (body.x + body.r > RIGHT_WALL) {
    const incoming = body.vx;
    body.x = RIGHT_WALL - body.r;
    if (body.vx > 0) body.vx = -body.vx * sideRestitution;
    if (incoming > 60) {
      body.omega -= incoming / Math.max(12, body.r) * 0.22;
      body.impact = Math.max(body.impact, Math.min(1, incoming / 520));
      if (reportImpact && incoming > 150) onImpact(incoming);
    }
  }

  if (body.y + body.r > FLOOR_Y) {
    const incoming = Math.max(0, body.vy);
    body.y = FLOOR_Y - body.r;

    if (body.vy > 0) {
      body.vy = incoming > 34 ? -incoming * floorRestitution : 0;
      if (incoming > 70) {
        body.impact = Math.max(body.impact, Math.min(1, incoming / 520));
        if (reportImpact && incoming > 170) onImpact(incoming);
      }
    }

    const slip = body.vx - body.omega * body.r;
    const correction = slip * WALL_FRICTION;
    body.vx -= correction;
    body.omega += correction / Math.max(10, body.r) * 1.7;

    if (Math.abs(body.vx) < 0.35) body.vx = 0;
    if (Math.abs(body.vy) < 0.35) body.vy = 0;
    if (Math.abs(body.omega) < 0.008) body.omega = 0;
  }
}

function resolvePair(
  a: Body,
  b: Body,
  onImpact: (strength: number) => void,
  reportImpact: boolean
) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let distance = Math.hypot(dx, dy);
  const minDistance = a.r + b.r;
  if (distance >= minDistance) return;

  if (distance < 0.0001) {
    dx = 0.01;
    dy = 0;
    distance = 0.01;
  }

  const nx = dx / distance;
  const ny = dy / distance;
  const tx = -ny;
  const ty = nx;
  const overlap = minDistance - distance;
  const invA = inverseMassOf(a);
  const invB = inverseMassOf(b);
  const invTotal = invA + invB;

  const positional = Math.max(0, overlap - 0.02) * 0.46;
  a.x -= nx * positional * (invA / invTotal);
  a.y -= ny * positional * (invA / invTotal);
  b.x += nx * positional * (invB / invTotal);
  b.y += ny * positional * (invB / invTotal);

  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const normalVelocity = rvx * nx + rvy * ny;
  const strength = Math.max(0, -normalVelocity);

  if (reportImpact) {
    const compression =
      overlap / Math.max(8, Math.min(a.r, b.r)) * 3.2 + strength / 1800;
    a.pressure = clamp(a.pressure + compression, 0, 1);
    b.pressure = clamp(b.pressure + compression, 0, 1);
  }

  let normalImpulse = 0;
  if (normalVelocity < -0.02) {
    const restitution = strength > 95 ? 0.13 : 0.025;
    normalImpulse = (-(1 + restitution) * normalVelocity) / invTotal;
    const ix = normalImpulse * nx;
    const iy = normalImpulse * ny;
    a.vx -= ix * invA;
    a.vy -= iy * invA;
    b.vx += ix * invB;
    b.vy += iy * invB;

    const spinA = a.omega * a.r;
    const spinB = b.omega * b.r;
    const tangentVelocity = rvx * tx + rvy * ty - spinA - spinB;
    const tangentMass =
      invTotal +
      (a.r * a.r) / inertiaOf(a) +
      (b.r * b.r) / inertiaOf(b);
    const rawTangentImpulse = -tangentVelocity / tangentMass;
    const maxFriction = Math.abs(normalImpulse) * CONTACT_FRICTION;
    const tangentImpulse = clamp(
      rawTangentImpulse,
      -maxFriction,
      maxFriction
    );

    a.vx -= tangentImpulse * tx * invA;
    a.vy -= tangentImpulse * ty * invA;
    b.vx += tangentImpulse * tx * invB;
    b.vy += tangentImpulse * ty * invB;
    a.omega -= (a.r * tangentImpulse) / inertiaOf(a);
    b.omega -= (b.r * tangentImpulse) / inertiaOf(b);

    if (strength > 70) {
      const visualImpact = Math.min(1, strength / 540);
      a.impact = Math.max(a.impact, visualImpact);
      b.impact = Math.max(b.impact, visualImpact);
    }
    if (reportImpact && strength > 175) onImpact(strength);
  }

  if (normalImpulse === 0 && overlap > 0.2) {
    const settle = Math.min(0.035, overlap * 0.0015);
    a.vx *= 1 - settle;
    b.vx *= 1 - settle;
  }
}

function broadPhase(bodies: Body[]) {
  return [...bodies].sort(
    (a, b) => a.x - a.r - (b.x - b.r)
  );
}

function findMerges(bodies: Body[], now: number) {
  const consumed = new Set<number>();
  const pairs: Array<[Body, Body]> = [];
  const ordered = broadPhase(bodies);

  for (let i = 0; i < ordered.length; i += 1) {
    const a = ordered[i]!;
    if (consumed.has(a.id)) continue;

    for (let j = i + 1; j < ordered.length; j += 1) {
      const b = ordered[j]!;
      if (b.x - b.r > a.x + a.r + 1.6) break;
      if (
        consumed.has(b.id) ||
        a.tier !== b.tier ||
        a.tier >= MAX_TIER ||
        now - a.bornAt < 105 ||
        now - b.bornAt < 105
      ) {
        continue;
      }

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const contactDistance = a.r + b.r;
      const mergeDistance = contactDistance + 1.6;
      if (dx * dx + dy * dy > mergeDistance * mergeDistance) continue;

      consumed.add(a.id);
      consumed.add(b.id);
      pairs.push([a, b]);
      break;
    }
  }

  return { consumed, pairs };
}

export function stepWorld(
  world: World,
  dt: number,
  now: number,
  onMerge: (event: { tier: number; x: number; y: number }) => void,
  onImpact: (strength: number) => void
) {
  for (const body of world.bodies) {
    body.pressure *= 0.975;
    body.impact = Math.max(0, body.impact - dt * 4.4);
    body.vy += GRAVITY * dt;
    body.vx *= AIR_DRAG;
    body.vy *= AIR_DRAG;
    body.omega *= ANGULAR_DRAG;
    body.vx = clamp(body.vx, -1100, 1100);
    body.vy = clamp(body.vy, -1100, 1100);
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    body.angle += body.omega * dt;
    resolveBoundary(body, onImpact, true);
  }

  const { consumed, pairs } = findMerges(world.bodies, now);
  if (pairs.length > 0) {
    const nextBodies = world.bodies.filter(body => !consumed.has(body.id));

    for (const [a, b] of pairs) {
      const massA = massOf(a);
      const massB = massOf(b);
      const totalMass = massA + massB;
      const tier = a.tier + 1;
      const merged = spawnBody(
        tier,
        (a.x * massA + b.x * massB) / totalMass,
        (a.y * massA + b.y * massB) / totalMass,
        now
      );

      merged.vx = (a.vx * massA + b.vx * massB) / totalMass;
      merged.vy = (a.vy * massA + b.vy * massB) / totalMass;
      merged.angle = Math.atan2(
        Math.sin(a.angle) + Math.sin(b.angle),
        Math.cos(a.angle) + Math.cos(b.angle)
      );
      merged.omega = (a.omega * massA + b.omega * massB) / totalMass;
      merged.impact = 0.78;
      merged.pressure = Math.min(0.5, (a.pressure + b.pressure) * 0.3);
      nextBodies.push(merged);
      onMerge({ tier, x: merged.x, y: merged.y });
    }

    world.bodies = nextBodies;
  }

  const solverIterations =
    world.bodies.length > 36
      ? Math.max(4, SOLVER_ITERATIONS - 2)
      : world.bodies.length > 20
        ? Math.max(5, SOLVER_ITERATIONS - 1)
        : SOLVER_ITERATIONS;

  for (let iteration = 0; iteration < solverIterations; iteration += 1) {
    const reportImpact = iteration === 0;
    const ordered = broadPhase(world.bodies);
    for (let i = 0; i < ordered.length; i += 1) {
      const a = ordered[i]!;
      resolveBoundary(a, onImpact, reportImpact);

      for (let j = i + 1; j < ordered.length; j += 1) {
        const b = ordered[j]!;
        if (b.x - b.r > a.x + a.r) break;
        resolvePair(a, b, onImpact, reportImpact);
      }
    }
  }

  for (const body of world.bodies) {
    resolveBoundary(body, onImpact, false);
    if (
      body.y + body.r >= FLOOR_Y - 0.5 &&
      Math.abs(body.vy) < 1 &&
      Math.abs(body.vx) < 1.2
    ) {
      body.vy = 0;
      body.vx *= 0.985;
    }
  }
}
