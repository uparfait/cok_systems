import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './assets/styles/globals.css'
import App from './App.tsx'

// PWA Service Worker Registration
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw2.js', {
        scope: '/'
      });

      console.log('[PWA] Service worker registered successfully:', registration.scope);

      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available, notify user
              console.log('[PWA] New content available, please refresh.');
              // You could dispatch a custom event here to show a toast notification
              window.dispatchEvent(new CustomEvent('sw-update-available'));
            }
          });
        }
      });

    } catch (error) {
      console.error('[PWA] Service worker registration failed:', error);
    }
  } else {
    console.log('[PWA] Service workers not supported in this browser');
  }
};

// PWA Install Prompt Handler
let deferredPrompt: any = null;

const setupInstallPrompt = () => {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;

    // Dispatch custom event to notify the app that PWA install is available
    window.dispatchEvent(new CustomEvent('pwa-install-available', { detail: { prompt: deferredPrompt } }));
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App was installed successfully');
    deferredPrompt = null;

    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('pwa-installed'));
  });
};

// Initialize PWA features
const initializePWA = () => {
  registerServiceWorker();
  setupInstallPrompt();
};

// Only initialize PWA features in production or when not on localhost
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  initializePWA();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
