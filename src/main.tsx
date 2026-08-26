import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import * as Neutralino from '@neutralinojs/lib';
import { flushPendingStorageSaves } from './utils/storageEngine.ts';
import App from './App.tsx';
import './index.css';

// Initialize Neutralino desktop engine if available
try {
  Neutralino.init();
  Neutralino.events.on('windowClose', async () => {
    try {
      flushPendingStorageSaves();
    } catch {
      // ignore
    }
    try {
      await Neutralino.app.exit();
    } catch {
      // ignore
    }
  });
} catch {
  // Gracefully fallback when running in Web/Mobile Capacitor environment
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
