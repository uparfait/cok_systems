// PWA Install Prompt Component
// Shows users how to install the PWA on their device

import React, { useState, useEffect } from 'react';
import { FiDownload, FiX, FiSmartphone, FiMonitor, FiChrome } from 'react-icons/fi';

interface PWAInstallPromptProps {
  onClose?: () => void;
  className?: string;
}

const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({ onClose, className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Detect device type
    const userAgent = navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent);
    const isAndroidDevice = /Android/.test(userAgent);
    const isDesktopDevice = !isIOSDevice && !isAndroidDevice && window.innerWidth > 768;

    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);
    setIsDesktop(isDesktopDevice);

    // Listen for PWA install availability
    const handleInstallAvailable = (event: any) => {
      setDeferredPrompt(event.detail.prompt);
      setIsVisible(true);
    };

    const handleInstalled = () => {
      setIsVisible(false);
    };

    window.addEventListener('pwa-install-available', handleInstallAvailable);
    window.addEventListener('pwa-installed', handleInstalled);

    // Show prompt after 10 seconds if on mobile and PWA install is available
    const timer = setTimeout(() => {
      if ((isIOSDevice || isAndroidDevice) && !isVisible) {
        // Check if app is not already installed
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        if (!isStandalone) {
          setIsVisible(true);
        }
      }
    }, 10000);

    return () => {
      window.removeEventListener('pwa-install-available', handleInstallAvailable);
      window.removeEventListener('pwa-installed', handleInstalled);
      clearTimeout(timer);
    };
  }, [isVisible]);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // Fallback for iOS or when prompt is not available
      if (isIOS) {
        alert('To install this app on iOS: tap the share button and select "Add to Home Screen"');
      } else if (isAndroid) {
        alert('To install this app: tap the menu button (⋮) and select "Add to Home screen" or "Install app"');
      }
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('[PWA] User accepted the install prompt');
    } else {
      console.log('[PWA] User dismissed the install prompt');
    }

    // Clear the deferred prompt
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  if (!isVisible) return null;

  return (
    <div className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 ${className}`}>
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <FiDownload className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Install COK Systems</h3>
              <p className="text-xs text-gray-600">Add to your home screen</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <FiX className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="mb-4">
          <p className="text-sm text-gray-700 mb-3">
            Install COK Systems for a better experience with offline access and native app features.
          </p>

          {/* Device-specific instructions */}
          {isIOS && (
            <div className="flex items-start gap-2 p-2 bg-blue-50 rounded-lg">
              <FiSmartphone className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-800">
                <strong>On iOS:</strong> Tap the share button <span className="inline-block w-4 h-4 bg-gray-300 rounded mx-1">⬆</span>
                and select "Add to Home Screen"
              </div>
            </div>
          )}

          {isAndroid && (
            <div className="flex items-start gap-2 p-2 bg-green-50 rounded-lg">
              <FiChrome className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-green-800">
                <strong>On Android:</strong> Tap the menu button (⋮) and select "Add to Home screen" or "Install app"
              </div>
            </div>
          )}

          {isDesktop && (
            <div className="flex items-start gap-2 p-2 bg-purple-50 rounded-lg">
              <FiMonitor className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-purple-800">
                <strong>On Desktop:</strong> Click the install button in your browser's address bar or use the install prompt
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleInstall}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <FiDownload className="w-4 h-4" />
            Install Now
          </button>
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;