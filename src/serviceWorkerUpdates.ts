export const BEFORE_UPDATE_EVENT = 'cat-territory:before-update';

const QUIET_WINDOW_MS = 1200;
const RESUME_CHECK_THROTTLE_MS = 60_000;
const PERIODIC_CHECK_MS = 15 * 60_000;

type UpdateMessage = {
  type?: string;
};

function startServiceWorkerUpdates() {
  let waitingWorker: ServiceWorker | null = null;
  let activationTimer: number | null = null;
  let activePointers = 0;
  let lastInteractionAt = performance.now();
  let lastUpdateCheckAt = 0;
  let hadController = Boolean(navigator.serviceWorker.controller);
  let reloadWhenVisible = false;
  let reloading = false;

  const flushSession = () =>
    window.dispatchEvent(new Event(BEFORE_UPDATE_EVENT));

  const reloadForController = () => {
    flushSession();
    if (!hadController) {
      hadController = true;
      return;
    }
    if (reloading) return;
    if (document.visibilityState === 'hidden') {
      reloadWhenVisible = true;
      return;
    }
    reloading = true;
    window.location.reload();
  };

  const clearActivationTimer = () => {
    if (activationTimer !== null) window.clearTimeout(activationTimer);
    activationTimer = null;
  };

  const activateWaitingWorker = () => {
    const worker = waitingWorker;
    if (!worker) return;
    waitingWorker = null;
    clearActivationTimer();
    flushSession();
    worker.postMessage({ type: 'ACTIVATE_UPDATE' });
  };

  const scheduleActivation = () => {
    clearActivationTimer();
    if (!waitingWorker) return;
    if (document.visibilityState === 'hidden') {
      activateWaitingWorker();
      return;
    }
    if (activePointers > 0) {
      activationTimer = window.setTimeout(scheduleActivation, 200);
      return;
    }
    const quietFor = performance.now() - lastInteractionAt;
    const delay = Math.max(0, QUIET_WINDOW_MS - quietFor);
    activationTimer = window.setTimeout(activateWaitingWorker, delay);
  };

  const queueWorker = (worker: ServiceWorker | null) => {
    if (!worker || !navigator.serviceWorker.controller) return;
    waitingWorker = worker;
    scheduleActivation();
  };

  const noteInteraction = () => {
    lastInteractionAt = performance.now();
    if (waitingWorker) scheduleActivation();
  };

  window.addEventListener(
    'pointerdown',
    () => {
      activePointers += 1;
      noteInteraction();
    },
    true,
  );
  window.addEventListener(
    'pointerup',
    () => {
      activePointers = Math.max(0, activePointers - 1);
      noteInteraction();
    },
    true,
  );
  window.addEventListener(
    'pointercancel',
    () => {
      activePointers = Math.max(0, activePointers - 1);
      noteInteraction();
    },
    true,
  );
  window.addEventListener('keydown', noteInteraction, true);
  window.addEventListener(
    'blur',
    () => {
      activePointers = 0;
      noteInteraction();
    },
    true,
  );
  navigator.serviceWorker.addEventListener('controllerchange', reloadForController);
  navigator.serviceWorker.addEventListener('message', (event) => {
    const message = event.data as UpdateMessage | null;
    if (message?.type === 'PREPARE_UPDATE') flushSession();
  });

  void navigator.serviceWorker
    .register('./sw.js', { updateViaCache: 'none' })
    .then((registration) => {
      const checkForUpdate = () => {
        lastUpdateCheckAt = Date.now();
        void registration.update().catch(() => undefined);
      };

      const watchInstallingWorker = () => {
        const worker = registration.installing;
        if (!worker) return;
        const installed = () => {
          if (worker.state === 'installed') queueWorker(registration.waiting);
        };
        worker.addEventListener('statechange', installed);
        installed();
      };

      registration.addEventListener('updatefound', watchInstallingWorker);
      watchInstallingWorker();
      queueWorker(registration.waiting);
      checkForUpdate();

      window.setInterval(() => {
        if (document.visibilityState === 'visible') checkForUpdate();
      }, PERIODIC_CHECK_MS);

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          if (waitingWorker) scheduleActivation();
          return;
        }
        if (reloadWhenVisible && !reloading) {
          reloadWhenVisible = false;
          reloading = true;
          window.location.reload();
          return;
        }
        if (Date.now() - lastUpdateCheckAt >= RESUME_CHECK_THROTTLE_MS)
          checkForUpdate();
        if (waitingWorker) scheduleActivation();
      });
    })
    .catch(() => undefined);
}

export function installServiceWorkerUpdates() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  if (document.readyState === 'complete') startServiceWorkerUpdates();
  else window.addEventListener('load', startServiceWorkerUpdates, { once: true });
}
