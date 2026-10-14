import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { initTelegramWebApp, initNativeAppearance, hideNativeSplashScreen } from './services/device/platform.ts';
import { enforcePermanentDarkTheme } from './services/theme/ThemeContext.tsx';

import { bootDiagnostics } from './services/device/bootDiagnostics.ts';

initTelegramWebApp();
initNativeAppearance();
enforcePermanentDarkTheme();

bootDiagnostics.logStage('APP_MOUNT', 'DOM mounting initiated');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Immediately request splash hide on initial render frame + safety fallback
requestAnimationFrame(() => {
  hideNativeSplashScreen();
});
setTimeout(() => {
  hideNativeSplashScreen();
}, 100);


