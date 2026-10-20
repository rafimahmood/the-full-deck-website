// Runs on every page: the cookie banner (and Google Analytics, only after Accept) and the service worker.
import { initBanner } from './banner.js';

initBanner();

if ('serviceWorker' in navigator) {
  const register = () => void navigator.serviceWorker.register('/sw.js').catch(() => {});
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);
}
