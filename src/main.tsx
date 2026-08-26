import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import * as Neutralino from '@neutralinojs/lib';
import App from './App.tsx';
import './index.css';

// Initialize Neutralino desktop engine if available
try {
  Neutralino.init();
} catch {
  // Gracefully fallback when running in Web/Mobile Capacitor environment
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
