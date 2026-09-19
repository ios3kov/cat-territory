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
};

const COINS_KEY = 'monster-merge-coins-v3';
const BEST_SCORE_KEY = 'monster-merge-best-score-v3';
const BEST_TIER_KEY = 'monster-merge-best-tier-v3';
const ORDER_KEY = 'monster-merge-order-v3';
const COACH_KEY = 'monster-merge-coach-v3';
const SPRITE_URLS = [
  'data:image/webp;base64,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',
  'data:image/webp;base64,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',
  'data:image/webp;base64,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',
  'data:image/webp;base64,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',
];
const SPRITE_MAP = [0, 1, 0, 0, 2, 3, 2, 3, 3];
const FILTERS = [
  'none',
  'none',
  'hue-rotate(320deg) saturate(1.12)',
  'hue-rotate(54deg) saturate(1.12)',
  'none',
  'none',
  'hue-rotate(42deg) saturate(1.08)',
  'hue-rotate(38deg) saturate(1.06)',
  'hue-rotate(120deg) saturate(1.12)',
];

const spriteImages = SPRITE_URLS.map((src) => {
  const image = new Image();
  image.decoding = 'async';
  image.src = src;
  return image;
});

const HYBRID_URLS = [
  'https://gcdn.picsart.com/editing-temp/ad119df8-9446-43c8-9cc5-9e2f0bb1fc47.png',
  'https://gcdn.picsart.com/editing-temp/53eec6f8-6032-4fd3-a984-a89e86f2f41b.png',
  'https://gcdn.picsart.com/editing-temp/9f61e77f-9ecb-43f8-8981-c862393901c6.png',
  'https://gcdn.picsart.com/editing-temp/d2099d24-c27d-4238-9a8f-08551cca3a84.png',
  'https://gcdn.picsart.com/editing-temp/47515fc2-d703-4118-a2a4-e84a07a37464.png',
  'https://gcdn.picsart.com/editing-temp/64e0bccb-a852-4bce-bbe7-78aa6110b32f.png',
  'https://gcdn.picsart.com/editing-temp/befcad88-208b-4ef0-a7e6-4200d3051b95.png',
  'https://gcdn.picsart.com/editing-temp/bdeb159e-d447-4166-93f7-90b37850eb30.png',
];
const HYBRID_TIER_MAP = [0, 1, 2, 3, 4, 5, 6, 7, 7];
const HYBRID_IRIS = ['#245ee8', '#13a757', '#7230a8', '#6b3519', '#a84a16', '#7831b5', '#1977df', '#7f4b25', '#7f4b25'];

const hybridImages = HYBRID_URLS.map((src) => {
  const image = new Image();
  image.decoding = 'async';
  image.crossOrigin = 'anonymous';
  image.src = src;
  return image;
});

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

function spriteIndex(tier: number) {
  return SPRITE_MAP[Math.min(MAX_TIER, tier)] ?? 5;
}

function MonsterArt({ tier, size = 42 }: { tier: number; size?: number }) {
  const hybridIndex = HYBRID_TIER_MAP[Math.min(MAX_TIER, tier)] ?? 7;
  const fallback = SPRITE_URLS[spriteIndex(tier)];
  const mode = faceMode(tier);
  return (
    <span
      className={'monster-art face-' + mode}
      data-tier={tier}
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      <img src={HYBRID_URLS[hybridIndex] ?? fallback} alt="" />
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
  const legacyIndex = spriteIndex(body.tier);
  const hybridIndex = HYBRID_TIER_MAP[Math.min(MAX_TIER, body.tier)] ?? 7;
  const speed = Math.hypot(body.vx ?? 0, body.vy ?? 0);
  const idle = speed < 70 ? Math.sin(time * 0.0021 + body.id * 1.19) : 0;
  const pressure = Math.min(1, body.pressure ?? 0);
  const impact = Math.min(1, body.impact ?? 0);
  const squash = impact * 0.075 + pressure * 0.035;
  const breathe = idle * 0.018 * (1 - pressure);
  const nervous = pressure > 0.46 ? Math.sin(time * 0.025 + body.id) * 0.018 : 0;
  const radius = body.r * (body.tier >= 5 ? 1.08 : 1.12);
  const size = radius * 2.46;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(body.x, body.y);
  ctx.rotate(body.angle + nervous);
  ctx.scale(1 + squash - breathe * 0.18, 1 - squash + breathe);

  const hybridImage = hybridImages[hybridIndex];
  const legacyImage = spriteImages[legacyIndex];
  const useHybrid = Boolean(hybridImage?.complete && hybridImage.naturalWidth > 0);
  const image = useHybrid ? hybridImage : legacyImage;
  ctx.filter = useHybrid
    ? 'none'
    : FILTERS[Math.min(FILTERS.length - 1, body.tier)] ?? 'none';

  if (image?.complete && image.naturalWidth > 0) {
    ctx.drawImage(image, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = TIER_DEFS[body.tier]!.base;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.filter = 'none';
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

  const nudge = useCallback(() => {
    if (uiRef.current.gameOver || worldRef.current.bodies.length === 0) return;
    for (const body of worldRef.current.bodies) {
      const direction = body.x < WIDTH / 2 ? -1 : 1;
      body.vx += direction * (26 + Math.random() * 24);
      body.vy -= 24 + Math.random() * 18;
      body.impact = Math.max(body.impact, 0.28);
    }
    playSound('bounce');
    haptic('merge');
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2.4, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(WIDTH * dpr);
    canvas.height = Math.round(HEIGHT * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let frame = 0;
    let previous = performance.now();
    let accumulator = 0;
    let lastBounce = -Infinity;

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
    return () => cancelAnimationFrame(frame);
  }, [flash, sync]);

  useEffect(() => () => {
    if (dropTimerRef.current !== null) window.clearTimeout(dropTimerRef.current);
    if (comboTimerRef.current !== null) window.clearTimeout(comboTimerRef.current);
    if (messageTimerRef.current !== null) window.clearTimeout(messageTimerRef.current);
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
            aria-label="Nudge monsters"
          >
            <RotateCcw size={22} />
            <span>POWER</span>
          </button>
        </div>

        {showMonsters && (
          <div className="monster-modal" role="dialog" aria-modal="true" aria-label="Monster evolution">
            <div className="monster-modal-card">
              <button className="modal-close" onClick={() => setShowMonsters(false)} aria-label="Close">×</button>
              <h2>MONSTER EVOLUTION</h2>
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
      </section>
    </main>
  );
}

export default App;
