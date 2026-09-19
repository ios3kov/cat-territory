import { RotateCcw, Volume2, VolumeX } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  installAudioUnlock,
  playSound,
  readSoundEnabled,
  setSoundEnabled,
} from './audio';
import { haptic } from './haptics';
import {
  DANGER_Y,
  FLOOR_Y,
  HEIGHT,
  LEFT_WALL,
  MAX_TIER,
  RIGHT_WALL,
  TIER_DEFS,
  WIDTH,
  spawnBody,
  stepWorld,
  type Body,
  type World,
} from './physics';
import { storageGet, storageSet } from './storage';

type Order = { tier: number; count: number; reward: number };
type Burst = { x: number; y: number; tier: number; start: number };
type Ui = {
  score: number;
  coins: number;
  bestScore: number;
  bestTier: number;
  orderNo: number;
  order: Order;
  progress: number;
  currentTier: number;
  nextTier: number;
  canDrop: boolean;
  gameOver: boolean;
  sound: boolean;
  combo: number;
  bestCombo: number;
  message: string;
  powerCharges: number;
};

const COINS_KEY = 'monster-merge-coins-v3';
const BEST_SCORE_KEY = 'monster-merge-best-score-v3';
const BEST_TIER_KEY = 'monster-merge-best-tier-v3';
const ORDER_KEY = 'monster-merge-order-v3';
const COACH_KEY = 'monster-merge-coach-v3';
const POWER_KEY = 'monster-merge-power-v1';
const POWER_COST = 200;
const HYBRID_ATLAS_URL =
  'https://gcdn.picsart.com/editing-temp/f69fe466-c03a-4502-b5c1-7c5dfce62c4c.webp';
const HYBRID_TIER_MAP = [0, 1, 2, 3, 4, 5, 6, 7, 7];
const HYBRID_IRIS = [
  '#245ee8',
  '#13a757',
  '#7230a8',
  '#6b3519',
  '#a84a16',
  '#7831b5',
  '#1977df',
  '#7f4b25',
  '#7f4b25',
];

const hybridAtlas = new Image();
hybridAtlas.decoding = 'async';
hybridAtlas.src = HYBRID_ATLAS_URL;

type FaceMode = 'normal' | 'cyclops' | 'closed' | 'wink';

function faceMode(tier: number): FaceMode {
  if (tier === 1 || tier === 6) return 'cyclops';
  if (tier === 3) return 'closed';
  if (tier >= 7) return 'wink';
  return 'normal';
}

function readInt(key: string, fallback = 0) {
  const value = Number(storageGet(key));
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function makeOrder(orderNo: number): Order {
  const seq = [1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7];
  const tier = seq[Math.min(seq.length - 1, Math.max(0, orderNo - 1))] ?? 1;
  const count = orderNo <= 3 ? 1 : orderNo <= 8 ? 2 : 3;
  return { tier, count, reward: (tier + 1) * count * 60 };
}

function spawnTier(bestTier: number) {
  const r = Math.random();
  if (bestTier >= 6 && r < 0.08) return 2;
  if (bestTier >= 3 && r < 0.28) return 1;
  return 0;
}

function atlasIndex(tier: number) {
  return HYBRID_TIER_MAP[Math.min(MAX_TIER, tier)] ?? 7;
}

function atlasPosition(index: number) {
  return {
    column: index % 4,
    row: Math.floor(index / 4),
  };
}

function MonsterArt({ tier, size = 42 }: { tier: number; size?: number }) {
  const index = atlasIndex(tier);
  const { column, row } = atlasPosition(index);
  const mode = faceMode(tier);
  return (
    <span
      className={'monster-art face-' + mode}
      data-tier={tier}
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      <span
        className="monster-body"
        style={{
          backgroundImage: 'url(' + HYBRID_ATLAS_URL + ')',
          backgroundSize: '400% 200%',
          backgroundPosition:
            String((column / 3) * 100) + '% ' + String(row * 100) + '%',
        }}
      />
      <span className="thumb-eye thumb-eye-left"><i /></span>
      <span className="thumb-eye thumb-eye-right"><i /></span>
      <span className="thumb-mouth" />
    </span>
  );
}

function drawTank(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  const top = 116;
  const glass = ctx.createLinearGradient(LEFT_WALL, 0, RIGHT_WALL, 0);
  glass.addColorStop(0, 'rgba(255,255,255,.16)');
  glass.addColorStop(0.14, 'rgba(255,255,255,.025)');
  glass.addColorStop(0.82, 'rgba(255,255,255,.02)');
  glass.addColorStop(1, 'rgba(255,255,255,.13)');
  ctx.fillStyle = glass;
  ctx.fillRect(LEFT_WALL, top, RIGHT_WALL - LEFT_WALL, FLOOR_Y - top);
}

function drawEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  pupilX: number,
  pupilY: number,
  pupilRadius: number,
  iris: string,
) {
  ctx.fillStyle = '#fffdf5';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(72,40,45,.22)';
  ctx.lineWidth = Math.max(0.7, rx * 0.07);
  ctx.stroke();

  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.arc(x + pupilX, y + pupilY, pupilRadius * 1.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#14203c';
  ctx.beginPath();
  ctx.arc(x + pupilX, y + pupilY, pupilRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(
    x + pupilX - pupilRadius * 0.32,
    y + pupilY - pupilRadius * 0.36,
    pupilRadius * 0.27,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}

function drawClosedEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
) {
  ctx.strokeStyle = '#4e2638';
  ctx.lineWidth = Math.max(1.3, width * 0.14);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - width / 2, y);
  ctx.quadraticCurveTo(x, y - width * 0.34, x + width / 2, y);
  ctx.stroke();
}

function drawRuntimeFace(
  ctx: CanvasRenderingContext2D,
  body: Pick<Body, 'id' | 'tier' | 'x' | 'y'> & {
    gazeX?: number;
    gazeY?: number;
    attention?: number;
    pressure?: number;
    impact?: number;
  },
  radius: number,
  time: number,
) {
  const tier = Math.min(MAX_TIER, body.tier);
  const mode = faceMode(tier);
  const pressure = Math.min(1, body.pressure ?? 0);
  const impact = Math.min(1, body.impact ?? 0);
  const attention = Math.min(1, body.attention ?? 0);
  const nervous = pressure > 0.42;
  const blink =
    !nervous &&
    ((time * 0.001 + body.id * 0.83) % (3.15 + (Math.abs(body.id) % 4) * 0.22)) <
      0.13;

  const targetX = (body.gazeX ?? body.x) - body.x;
  const targetY = (body.gazeY ?? body.y) - body.y;
  const targetLength = Math.max(1, Math.hypot(targetX, targetY));
  const gazeScaleX = radius * (0.055 + attention * 0.025);
  const gazeScaleY = radius * (0.04 + attention * 0.018);
  const idleWeight = Math.max(0, 1 - attention);
  const idleGazeX =
    Math.sin(time * 0.00135 + body.id * 1.31) * radius * 0.027 * idleWeight;
  const idleGazeY =
    Math.cos(time * 0.00105 + body.id * 0.73) * radius * 0.018 * idleWeight;
  const gazeX = (targetX / targetLength) * gazeScaleX + idleGazeX;
  const gazeY = (targetY / targetLength) * gazeScaleY + idleGazeY;
  const eyeY = -radius * (nervous ? 0.15 : 0.13);
  const iris = HYBRID_IRIS[tier] ?? '#315ed8';

  if (mode === 'closed') {
    drawClosedEye(ctx, -radius * 0.24, eyeY, radius * 0.25);
    drawClosedEye(ctx, radius * 0.24, eyeY, radius * 0.25);
  } else if (mode === 'cyclops') {
    if (blink) {
      drawClosedEye(ctx, 0, eyeY, radius * 0.42);
    } else {
      drawEye(
        ctx,
        0,
        eyeY,
        radius * 0.34,
        radius * (nervous ? 0.28 : 0.36),
        gazeX * 1.2,
        gazeY,
        radius * 0.14,
        iris,
      );
    }
  } else if (mode === 'wink') {
    if (blink) {
      drawClosedEye(ctx, -radius * 0.23, eyeY, radius * 0.24);
    } else {
      drawEye(
        ctx,
        -radius * 0.23,
        eyeY,
        radius * 0.22,
        radius * 0.28,
        gazeX,
        gazeY,
        radius * 0.095,
        iris,
      );
    }
    drawClosedEye(ctx, radius * 0.24, eyeY + radius * 0.015, radius * 0.23);
  } else if (blink) {
    drawClosedEye(ctx, -radius * 0.23, eyeY, radius * 0.23);
    drawClosedEye(ctx, radius * 0.23, eyeY, radius * 0.23);
  } else {
    const eyeRy = radius * (nervous ? 0.235 : 0.28);
    drawEye(
      ctx,
      -radius * 0.23,
      eyeY,
      radius * 0.215,
      eyeRy,
      gazeX,
      gazeY,
      radius * 0.095,
      iris,
    );
    drawEye(
      ctx,
      radius * 0.23,
      eyeY,
      radius * 0.215,
      eyeRy,
      gazeX,
      gazeY,
      radius * 0.095,
      iris,
    );
  }

  if (tier === 0 || tier === 2 || tier === 3) {
    ctx.fillStyle = 'rgba(255,112,144,.34)';
    ctx.beginPath();
    ctx.arc(-radius * 0.52, radius * 0.12, radius * 0.095, 0, Math.PI * 2);
    ctx.arc(radius * 0.52, radius * 0.12, radius * 0.095, 0, Math.PI * 2);
    ctx.fill();
  }

  if (nervous) {
    ctx.strokeStyle = '#5c2939';
    ctx.lineWidth = Math.max(1.3, radius * 0.045);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-radius * 0.17, radius * 0.28);
    ctx.quadraticCurveTo(
      -radius * 0.05,
      radius * 0.21,
      0,
      radius * 0.3,
    );
    ctx.quadraticCurveTo(
      radius * 0.06,
      radius * 0.39,
      radius * 0.18,
      radius * 0.29,
    );
    ctx.stroke();
    if (pressure > 0.62) {
      ctx.fillStyle = 'rgba(190,242,255,.92)';
      ctx.beginPath();
      ctx.ellipse(
        radius * 0.58,
        -radius * 0.31,
        radius * 0.065,
        radius * 0.115,
        -0.35,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    return;
  }

  ctx.fillStyle = '#5c2031';
  ctx.beginPath();
  if (attention > 0.72 || impact > 0.52) {
    ctx.ellipse(
      0,
      radius * 0.25,
      radius * 0.155,
      radius * 0.18,
      0,
      0,
      Math.PI * 2,
    );
  } else {
    ctx.arc(
      0,
      radius * 0.19,
      radius * 0.23,
      0.07 * Math.PI,
      0.93 * Math.PI,
    );
    ctx.lineTo(-radius * 0.23, radius * 0.19);
  }
  ctx.fill();

  ctx.fillStyle = '#ff6475';
  ctx.beginPath();
  ctx.ellipse(
    0,
    radius * 0.31,
    radius * 0.105,
    radius * 0.07,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  if (tier === 2 || tier === 4 || tier === 5 || tier === 6) {
    ctx.fillStyle = '#fff8eb';
    const fangY = radius * 0.18;
    const fangSize = radius * 0.1;
    for (const x of tier === 6 ? [-0.13, 0.13] : [-0.11]) {
      ctx.beginPath();
      ctx.moveTo(x * radius - fangSize * 0.45, fangY);
      ctx.lineTo(x * radius + fangSize * 0.45, fangY);
      ctx.lineTo(x * radius, fangY + fangSize);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawMonster(
  ctx: CanvasRenderingContext2D,
  body: Pick<Body, 'id' | 'tier' | 'x' | 'y' | 'r' | 'angle' | 'impact' | 'pressure'> &
    Partial<Pick<Body, 'vx' | 'vy'>> & {
      gazeX?: number;
      gazeY?: number;
      attention?: number;
    },
  time: number,
  alpha = 1,
) {
  const index = atlasIndex(body.tier);
  const { column, row } = atlasPosition(index);
  const speed = Math.hypot(body.vx ?? 0, body.vy ?? 0);
  const idle = speed < 70 ? Math.sin(time * 0.0021 + body.id * 1.19) : 0;
  const pressure = Math.min(1, body.pressure ?? 0);
  const impact = Math.min(1, body.impact ?? 0);
  const squash = impact * 0.075 + pressure * 0.035;
  const breathe = idle * 0.018 * (1 - pressure);
  const nervous = pressure > 0.46
    ? Math.sin(time * 0.025 + body.id) * 0.018
    : 0;
  const radius = body.r * (body.tier >= 5 ? 1.08 : 1.12);
  const size = radius * 2.46;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(body.x, body.y);
  ctx.rotate(body.angle + nervous);
  ctx.scale(1 + squash - breathe * 0.18, 1 - squash + breathe);

  if (hybridAtlas.complete && hybridAtlas.naturalWidth > 0) {
    const sw = hybridAtlas.naturalWidth / 4;
    const sh = hybridAtlas.naturalHeight / 2;
    ctx.drawImage(
      hybridAtlas,
      column * sw,
      row * sh,
      sw,
      sh,
      -size / 2,
      -size / 2,
      size,
      size,
    );
  } else {
    ctx.fillStyle = TIER_DEFS[body.tier]!.base;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  drawRuntimeFace(ctx, body, radius, time);
  ctx.restore();
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World>({ bodies: [] });
  const aimXRef = useRef(WIDTH / 2);
  const dropTimerRef = useRef<number | null>(null);
  const comboTimerRef = useRef<number | null>(null);
  const messageTimerRef = useRef<number | null>(null);
  const dangerRef = useRef<number | null>(null);
  const lastMergeRef = useRef(-Infinity);
  const burstsRef = useRef<Burst[]>([]);

  const initialOrderNo = Math.max(1, readInt(ORDER_KEY, 1));
  const initialBestTier = readInt(BEST_TIER_KEY, 0);
  const [coach, setCoach] = useState(storageGet(COACH_KEY) !== 'done');
  const [showMonsters, setShowMonsters] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showLab, setShowLab] = useState(false);
  const [ui, setUi] = useState<Ui>(() => ({
    score: 0,
    coins: readInt(COINS_KEY, 0),
    bestScore: readInt(BEST_SCORE_KEY, 0),
    bestTier: initialBestTier,
    orderNo: initialOrderNo,
    order: makeOrder(initialOrderNo),
    progress: 0,
    currentTier: 0,
    nextTier: spawnTier(initialBestTier),
    canDrop: true,
    gameOver: false,
    sound: readSoundEnabled(),
    combo: 0,
    bestCombo: 0,
    message: '',
    powerCharges: readInt(POWER_KEY, 1),
  }));
  const uiRef = useRef(ui);
  uiRef.current = ui;

  const sync = useCallback(() => setUi({ ...uiRef.current }), []);

  useEffect(() => {
    installAudioUnlock();
  }, []);

  const flash = useCallback((message: string) => {
    uiRef.current.message = message;
    sync();
    if (messageTimerRef.current !== null) window.clearTimeout(messageTimerRef.current);
    messageTimerRef.current = window.setTimeout(() => {
      uiRef.current.message = '';
      sync();
    }, 1100);
  }, [sync]);

  const updateAim = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const r = TIER_DEFS[uiRef.current.currentTier]!.radius;
    aimXRef.current = Math.max(LEFT_WALL + r + 2, Math.min(RIGHT_WALL - r - 2, x));
  }, []);

  const drop = useCallback(() => {
    const state = uiRef.current;
    if (!state.canDrop || state.gameOver) return;
    const tier = state.currentTier;
    const r = TIER_DEFS[tier]!.radius;
    const x = aimXRef.current;
    const blocked = worldRef.current.bodies.some((body) => {
      const dx = body.x - x;
      const dy = body.y - 82;
      return dx * dx + dy * dy < (body.r + r + 4) ** 2;
    });
    if (blocked) {
      flash('No room here');
      playSound('fail');
      haptic('fail');
      return;
    }

    worldRef.current.bodies.push(spawnBody(tier, x, 82, performance.now()));
    state.currentTier = state.nextTier;
    state.nextTier = spawnTier(state.bestTier);
    state.canDrop = false;
    sync();
    if (coach) {
      storageSet(COACH_KEY, 'done');
      setCoach(false);
    }
    playSound('drop');
    haptic('drop');

    if (dropTimerRef.current !== null) window.clearTimeout(dropTimerRef.current);
    dropTimerRef.current = window.setTimeout(() => {
      if (!uiRef.current.gameOver) {
        uiRef.current.canDrop = true;
        sync();
      }
    }, 430);
  }, [coach, flash, sync]);

  const restart = useCallback(() => {
    worldRef.current.bodies = [];
    burstsRef.current = [];
    dangerRef.current = null;
    lastMergeRef.current = -Infinity;
    if (dropTimerRef.current !== null) window.clearTimeout(dropTimerRef.current);
    if (comboTimerRef.current !== null) window.clearTimeout(comboTimerRef.current);
    const state = uiRef.current;
    state.score = 0;
    state.progress = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.currentTier = 0;
    state.nextTier = spawnTier(state.bestTier);
    state.canDrop = true;
    state.gameOver = false;
    state.message = '';
    aimXRef.current = WIDTH / 2;
    sync();
    playSound('restart');
    haptic('restart');
  }, [sync]);

  const buyPower = useCallback(() => {
    const state = uiRef.current;
    if (state.coins < POWER_COST) {
      flash('Need ' + String(POWER_COST) + ' coins');
      playSound('fail');
      haptic('fail');
      return;
    }
    state.coins -= POWER_COST;
    state.powerCharges += 1;
    storageSet(COINS_KEY, String(state.coins));
    storageSet(POWER_KEY, String(state.powerCharges));
    sync();
    playSound('order');
    haptic('order');
  }, [flash, sync]);

  const nudge = useCallback(() => {
    const state = uiRef.current;
    if (state.gameOver) return;
    if (state.powerCharges <= 0) {
      setShowShop(true);
      flash('Get a Pulse in Shop');
      return;
    }
    if (worldRef.current.bodies.length === 0) {
      flash('Drop a monster first');
      return;
    }
    state.powerCharges -= 1;
    storageSet(POWER_KEY, String(state.powerCharges));
    sync();
    for (const body of worldRef.current.bodies) {
      const direction = body.x < WIDTH / 2 ? -1 : 1;
      body.vx += direction * (26 + Math.random() * 24);
      body.vy -= 24 + Math.random() * 18;
      body.impact = Math.max(body.impact, 0.28);
    }
    playSound('bounce');
    haptic('merge');
  }, [flash, sync]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(WIDTH * dpr);
    canvas.height = Math.round(HEIGHT * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let frame = 0;
    let previous = performance.now();
    let accumulator = 0;
    let lastBounce = -Infinity;
    let paused = document.hidden;
    const onVisibility = () => {
      paused = document.hidden;
      previous = performance.now();
      accumulator = 0;
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onMerge = ({ tier, x, y }: { tier: number; x: number; y: number }) => {
      const state = uiRef.current;
      const now = performance.now();
      state.combo = now - lastMergeRef.current <= 1100
        ? Math.min(9, Math.max(1, state.combo) + 1)
        : 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      lastMergeRef.current = now;
      state.score += Math.round(10 * 2 ** tier * (1 + (state.combo - 1) * 0.25));
      state.bestTier = Math.max(state.bestTier, tier);
      state.bestScore = Math.max(state.bestScore, state.score);
      storageSet(BEST_TIER_KEY, String(state.bestTier));
      storageSet(BEST_SCORE_KEY, String(state.bestScore));
      burstsRef.current.push({ x, y, tier, start: now });
      if (burstsRef.current.length > 14) burstsRef.current.shift();

      if (comboTimerRef.current !== null) window.clearTimeout(comboTimerRef.current);
      comboTimerRef.current = window.setTimeout(() => {
        uiRef.current.combo = 0;
        sync();
      }, 1250);

      if (tier === state.order.tier) {
        state.progress += 1;
        if (state.progress >= state.order.count) {
          const reward = state.order.reward;
          state.coins += reward;
          state.orderNo += 1;
          state.order = makeOrder(state.orderNo);
          state.progress = 0;
          storageSet(COINS_KEY, String(state.coins));
          storageSet(ORDER_KEY, String(state.orderNo));
          flash('Order complete +' + String(reward));
          playSound('order');
          haptic('order');
        } else {
          playSound('merge');
          haptic('merge');
        }
      } else {
        playSound('merge');
        haptic('merge');
      }
      sync();
    };

    const onImpact = (strength: number) => {
      const now = performance.now();
      if (strength > 185 && now - lastBounce > 90) {
        lastBounce = now;
        playSound('bounce');
      }
    };

    const draw = (time: number) => {
      drawTank(ctx);

      const danger = dangerRef.current === null ? 0 : Math.min(1, (time - dangerRef.current) / 1400);
      if (danger > 0) {
        ctx.fillStyle = 'rgba(205,55,67,' + String(0.06 + danger * 0.15) + ')';
        ctx.fillRect(LEFT_WALL + 2, DANGER_Y - 12, RIGHT_WALL - LEFT_WALL - 4, 24);
      }
      ctx.strokeStyle = danger > 0 ? 'rgba(196,58,58,.96)' : 'rgba(255,255,255,.84)';
      ctx.setLineDash([7, 7]);
      ctx.lineWidth = danger > 0 ? 2.4 : 1.5;
      ctx.beginPath();
      ctx.moveTo(LEFT_WALL + 8, DANGER_Y);
      ctx.lineTo(RIGHT_WALL - 8, DANGER_Y);
      ctx.stroke();
      ctx.setLineDash([]);

      const tier = uiRef.current.currentTier;
      const def = TIER_DEFS[tier]!;
      let guideY = FLOOR_Y - def.radius - 2;
      for (const body of worldRef.current.bodies) {
        const dx = Math.abs(body.x - aimXRef.current);
        const combined = body.r + def.radius;
        if (dx >= combined) continue;
        const offset = Math.sqrt(Math.max(0, combined * combined - dx * dx));
        const y = body.y - offset - 2;
        if (y > 95) guideY = Math.min(guideY, y);
      }
      ctx.strokeStyle = 'rgba(255,255,255,.93)';
      ctx.setLineDash([7, 7]);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(aimXRef.current, 86 + def.radius);
      ctx.lineTo(aimXRef.current, guideY);
      ctx.stroke();
      ctx.setLineDash([]);

      const bodies = worldRef.current.bodies;
      for (const body of bodies) {
        let gazeX = aimXRef.current;
        let gazeY = 77;
        let attention = 0.2;
        const bodySpeed = Math.hypot(body.vx, body.vy);

        if (bodySpeed > 220) {
          gazeX = body.x + body.vx * 0.14;
          gazeY = body.y + body.vy * 0.14;
          attention = 0.34;
        }

        let nearest = Infinity;
        for (const other of bodies) {
          if (other.id === body.id || other.tier !== body.tier) continue;
          const dx = other.x - body.x;
          const dy = other.y - body.y;
          const distance = Math.hypot(dx, dy);
          const reach = (body.r + other.r) * 1.85;
          if (distance < reach && distance < nearest) {
            nearest = distance;
            gazeX = other.x;
            gazeY = other.y;
            attention = Math.max(0.48, 1 - distance / reach);
          }
        }

        drawMonster(ctx, { ...body, gazeX, gazeY, attention }, time);
      }

      if (!uiRef.current.gameOver) {
        let previewGazeX = aimXRef.current;
        let previewGazeY = guideY;
        let previewAttention = 0.3;
        let previewNearest = Infinity;
        for (const body of bodies) {
          const dx = body.x - aimXRef.current;
          const dy = body.y - 77;
          const distance = Math.hypot(dx, dy);
          if (distance < previewNearest) {
            previewNearest = distance;
            previewGazeX = body.x;
            previewGazeY = body.y;
            previewAttention = 0.72;
          }
        }
        drawMonster(ctx, {
          id: -100 - tier,
          tier,
          x: aimXRef.current,
          y: 77,
          r: def.radius,
          angle: Math.sin(time * 0.002) * 0.028,
          impact: 0,
          pressure: 0,
          gazeX: previewGazeX,
          gazeY: previewGazeY,
          attention: previewAttention,
        }, time, uiRef.current.canDrop ? 1 : 0.5);
      }

      burstsRef.current = burstsRef.current.filter((burst) => time - burst.start < 560);
      for (const burst of burstsRef.current) {
        const age = (time - burst.start) / 520;
        if (age < 0 || age > 1) continue;
        const color = TIER_DEFS[burst.tier]!.accent;
        ctx.save();
        ctx.globalAlpha = (1 - age) * 0.75;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3.5 * (1 - age) + 1;
        ctx.beginPath();
        ctx.arc(burst.x, burst.y, 13 + age * (28 + burst.tier * 4), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    };

    const loop = (time: number) => {
      if (paused) {
        previous = time;
        frame = requestAnimationFrame(loop);
        return;
      }
      const delta = Math.min(0.05, (time - previous) / 1000);
      previous = time;
      accumulator += delta;
      while (accumulator >= 1 / 120) {
        if (!uiRef.current.gameOver) stepWorld(worldRef.current, 1 / 120, time, onMerge, onImpact);
        accumulator -= 1 / 120;
      }

      if (!uiRef.current.gameOver) {
        const offender = worldRef.current.bodies.some((body) => {
          const speed = Math.hypot(body.vx, body.vy);
          return time - body.bornAt > 900 && body.y - body.r < DANGER_Y && speed < 70;
        });
        if (offender) {
          if (dangerRef.current === null) dangerRef.current = time;
          if (time - dangerRef.current > 1400) {
            uiRef.current.gameOver = true;
            uiRef.current.canDrop = false;
            uiRef.current.bestScore = Math.max(uiRef.current.bestScore, uiRef.current.score);
            storageSet(BEST_SCORE_KEY, String(uiRef.current.bestScore));
            sync();
            playSound('fail');
            haptic('fail');
          }
        } else {
          dangerRef.current = null;
        }
      }

      draw(time);
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      cancelAnimationFrame(frame);
    };
  }, [flash, sync]);

  useEffect(() => () => {
    if (dropTimerRef.current !== null) window.clearTimeout(dropTimerRef.current);
    if (comboTimerRef.current !== null) window.clearTimeout(comboTimerRef.current);
    if (messageTimerRef.current !== null) window.clearTimeout(messageTimerRef.current);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setShowMonsters(false);
      setShowShop(false);
      setShowLab(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const toggleSound = () => {
    const next = !uiRef.current.sound;
    setSoundEnabled(next);
    uiRef.current.sound = next;
    sync();
    if (next) playSound('ui');
  };

  const orders = [ui.order, makeOrder(ui.orderNo + 1), makeOrder(ui.orderNo + 2)];

  return (
    <main className="app-shell">
      <section className="game-shell">
        <div className="top-actions concept-top-actions">
          <div className="coin-pill" aria-label={String(ui.coins) + ' coins'}>
            <span className="coin">●</span>
            <strong>{ui.coins.toLocaleString()}</strong>
          </div>
          <button className="icon-button" onClick={toggleSound} aria-label={'Sound ' + (ui.sound ? 'on' : 'off')}>
            {ui.sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
          </button>
        </div>

        <div className="next-board" aria-label={'Next monster tier ' + String(ui.nextTier + 1)}>
          <strong>NEXT</strong>
          <MonsterArt tier={ui.nextTier} size={60} />
        </div>

        <section className="orders-board" aria-label="Orders">
          <h2>ORDERS</h2>
          {orders.map((order, index) => (
            <div className={'order-row ' + (index === 0 ? 'current' : '')} key={String(ui.orderNo) + '-' + String(index)}>
              <MonsterArt tier={order.tier} size={34} />
              <span>{index === 0 ? ui.progress : 0}/{order.count}</span>
              <b>● +{order.reward}</b>
            </div>
          ))}
          <div className="order-track" aria-hidden="true">
            <i style={{ width: String(Math.min(100, (ui.progress / ui.order.count) * 100)) + '%' }} />
          </div>
        </section>

        <div className="game-frame">
          <div className="canvas-wrap">
            <canvas
              ref={canvasRef}
              className="physics-canvas"
              aria-label="Monster tank. Drag horizontally and release to drop."
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                updateAim(event);
              }}
              onPointerMove={(event) => {
                if (event.buttons || event.pointerType === 'touch') updateAim(event);
              }}
              onPointerUp={(event) => {
                updateAim(event);
                drop();
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
              }}
              onPointerCancel={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
              }}
            />
            {coach && !ui.gameOver && (
              <button className="coach" onClick={() => { storageSet(COACH_KEY, 'done'); setCoach(false); }}>
                Drag to aim · release to drop
              </button>
            )}
            {ui.combo > 1 && <div className="combo-badge">CHAIN ×{ui.combo}</div>}
            {ui.message && <div className="toast" role="status">{ui.message}</div>}
            {ui.gameOver && (
              <div className="game-over" role="dialog" aria-modal="true">
                <div className="game-over-card">
                  <span>LAB OVERFLOW</span>
                  <h2>{ui.score}</h2>
                  <p>Best {ui.bestScore}</p>
                  <button onClick={restart}>Try again</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="score-plaque">
          <span>SCORE</span>
          <strong>{ui.score}</strong>
          {ui.bestCombo > 1 && <small>BEST ×{ui.bestCombo}</small>}
        </div>

        <div className="concept-toolbar">
          <button
            type="button"
            onClick={() => setShowShop(true)}
            className="wood-button shop-hit"
            aria-label="Shop"
          >
            SHOP
          </button>
          <button
            type="button"
            onClick={() => setShowMonsters(true)}
            className="wood-button monsters-hit"
            aria-label="Monsters"
          >
            MONSTERS
          </button>
          <button
            type="button"
            onClick={drop}
            className="concept-drop-button drop-hit"
            disabled={!ui.canDrop || ui.gameOver}
            aria-label="Drop monster"
          >
            DROP
          </button>
          <button
            type="button"
            onClick={nudge}
            className="wood-button power-hit"
            aria-label={'Power-up. ' + String(ui.powerCharges) + ' available'}
          >
            <RotateCcw size={22} />
            <span>POWER</span>
            {ui.powerCharges > 0 && (
              <b className="power-charge" aria-hidden="true">{ui.powerCharges}</b>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowLab(true)}
            className="wood-button lab-hit"
            aria-label="Lab stats"
          >
            LAB
          </button>
        </div>

        {showMonsters && (
          <div className="monster-modal" role="dialog" aria-modal="true" aria-labelledby="evolution-title">
            <div className="monster-modal-card">
              <button autoFocus className="modal-close" onClick={() => setShowMonsters(false)} aria-label="Close">×</button>
              <h2 id="evolution-title">MONSTER EVOLUTION</h2>
              <div className="evolution-grid">
                {TIER_DEFS.map((def, tier) => (
                  <div key={def.name} className={tier <= ui.bestTier + 1 ? '' : 'locked'}>
                    <MonsterArt tier={tier} size={66} />
                    <span>{def.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {showShop && (
          <div className="monster-modal" role="dialog" aria-modal="true" aria-labelledby="shop-title">
            <div className="monster-modal-card shop-card">
              <button autoFocus className="modal-close" onClick={() => setShowShop(false)} aria-label="Close">×</button>
              <h2 id="shop-title">SHOP</h2>
              <div className="shop-item">
                <MonsterArt tier={4} size={72} />
                <div>
                  <strong>Pulse</strong>
                  <span>Loosens a crowded pile and creates new merge chances.</span>
                </div>
                <button
                  type="button"
                  className="buy-button"
                  onClick={buyPower}
                  disabled={ui.coins < POWER_COST}
                >
                  ● {POWER_COST}
                </button>
              </div>
              <p className="shop-stock">Owned: {ui.powerCharges}</p>
            </div>
          </div>
        )}

        {showLab && (
          <div className="monster-modal" role="dialog" aria-modal="true" aria-labelledby="lab-title">
            <div className="monster-modal-card lab-card">
              <button autoFocus className="modal-close" onClick={() => setShowLab(false)} aria-label="Close">×</button>
              <h2 id="lab-title">LAB</h2>
              <dl className="lab-stats">
                <div><dt>Best score</dt><dd>{ui.bestScore}</dd></div>
                <div><dt>Orders completed</dt><dd>{Math.max(0, ui.orderNo - 1)}</dd></div>
                <div><dt>Highest evolution</dt><dd>{TIER_DEFS[Math.min(ui.bestTier, MAX_TIER)]!.name}</dd></div>
                <div><dt>Coins</dt><dd>{ui.coins}</dd></div>
              </dl>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
