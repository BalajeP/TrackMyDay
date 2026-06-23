import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('✅ PWA: App is already installed and running in standalone mode');
      setIsInstalled(true);
      return;
    }

    console.log('ℹ️ PWA: Waiting for beforeinstallprompt event...');

    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('✅ PWA: beforeinstallprompt event fired - app is installable!');
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      console.log('✅ PWA: App successfully installed!');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Debug: Check if service worker is registered
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          console.log('✅ PWA: Service worker is registered', reg);
        } else {
          console.log('⚠️ PWA: No service worker registered yet');
        }
      });
    } else {
      console.log('❌ PWA: Service workers not supported in this browser');
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) {
      console.log('⚠️ PWA: No install prompt available. This could mean:');
      console.log('  - App is already installed');
      console.log('  - Browser doesnt support PWA install');
      console.log('  - App not served over HTTPS (except localhost)');
      console.log('  - Service worker not registered');
      return;
    }

    console.log('ℹ️ PWA: Showing install prompt...');
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    console.log(`ℹ️ PWA: User ${outcome} the install prompt`);

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  return {
    isInstallable,
    isInstalled,
    promptInstall
  };
}
