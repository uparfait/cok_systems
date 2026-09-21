import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './assets/styles/globals.css'
import App from './App.tsx'
import { apply_form_manifest, is_public_form_path } from './systems/dcs/pwa/dynamicManifest.js'

// A public data-collection form gets its own manifest before anything else
// runs, so an install from that page opens the form itself, not "/".
if (is_public_form_path(window.location.pathname)) {
  apply_form_manifest({ start_url: window.location.pathname + window.location.search });
}

const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    console.log('[IKAZE] Service workers not supported in this browser');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    console.log('[IKAZE] Service worker registered:', registration.scope);

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[IKAZE] New content available, please refresh.');
            window.dispatchEvent(new CustomEvent('sw-update-available'));
          }
        });
      }
    });

  } catch (error) {
    console.error('[IKAZE] Service worker registration failed:', error);
  }
};

// PWA Install Prompt Handler
let deferredPrompt: any = null;

const setupInstallPrompt = () => {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    (window as any).__dcs_install_prompt = e;
    window.dispatchEvent(new CustomEvent('pwa-install-available', { detail: { prompt: deferredPrompt } }));
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App was installed successfully');
    deferredPrompt = null;
    (window as any).__dcs_install_prompt = null;
    window.dispatchEvent(new CustomEvent('pwa-installed'));
  });
};

registerServiceWorker();
setupInstallPrompt();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
