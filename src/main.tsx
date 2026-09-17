import { LoadingTerritory, TerritoryBoundary } from './LoadingTerritory';
import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { runWhenIdle } from './scheduler';
import { installAudioUnlock } from './audio';
import { removeRetiredModeSaves } from './storageMigration';
import './index.css';
import './round2.css';
import './autoX.css';
import './nextLevelSlide.css';
import './achievementFeedback.css';
removeRetiredModeSaves();
installAudioUnlock();
const syncPageVisibility = () =>
  document.documentElement.classList.toggle(
    'page-hidden',
    document.visibilityState === 'hidden',
  );
syncPageVisibility();
document.addEventListener('visibilitychange', syncPageVisibility);
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener(
    'load',
    () => {
      const register = () =>
        navigator.serviceWorker
          .register('./sw.js', { updateViaCache: 'none' })
          .then((registration) => registration.update())
          .catch(() => undefined);
      runWhenIdle(() => void register(), 4000, 2000);
    },
    { once: true },
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TerritoryBoundary>
      <Suspense fallback={<LoadingTerritory />}>
        <App />
      </Suspense>
    </TerritoryBoundary>
  </StrictMode>,
);
