import { ReactNode, useEffect } from 'react';

interface Props {
  children: ReactNode;
}

export default function PWAWrapper({ children }: Props) {
  useEffect(() => {
    // Dynamically inject manifest link if it doesn't exist
    const existingManifest = document.querySelector('link[rel="manifest"]');
    if (!existingManifest) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/manifest.json';
      document.head.appendChild(link);
    }

    // Add theme color meta tag
    const existingTheme = document.querySelector('meta[name="theme-color"]');
    if (!existingTheme) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = '#6366f1';
      document.head.appendChild(meta);
    }

    // Add apple touch icon
    const existingApple = document.querySelector('link[rel="apple-touch-icon"]');
    if (!existingApple) {
      const link = document.createElement('link');
      link.rel = 'apple-touch-icon';
      link.href = '/icon.svg';
      document.head.appendChild(link);
    }

    // Add viewport meta for mobile
    const existingViewport = document.querySelector('meta[name="viewport"]');
    if (!existingViewport) {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes';
      document.head.appendChild(meta);
    }

    // Update title
    document.title = 'Track My Day';
  }, []);

  return <>{children}</>;
}
