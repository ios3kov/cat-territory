import { LoadingTerritory, TerritoryBoundary } from './LoadingTerritory';
import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { installAudioUnlock } from './audio';
import { removeRetiredModeSaves } from './storageMigration';
import { installServiceWorkerUpdates } from './serviceWorkerUpdates';
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
installServiceWorkerUpdates();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TerritoryBoundary>
      <Suspense fallback={<LoadingTerritory />}>
        <App />
      </Suspense>
    </TerritoryBoundary>
  </StrictMode>,
);
