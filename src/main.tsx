import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initTelegramWebApp, initNativeAppearance, hideNativeSplashScreen } from './services/device/platform.ts';
import { enforcePermanentDarkTheme } from './services/theme/ThemeContext.tsx';

initTelegramWebApp();
initNativeAppearance();
enforcePermanentDarkTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

requestAnimationFrame(() => {
  hideNativeSplashScreen();
});

