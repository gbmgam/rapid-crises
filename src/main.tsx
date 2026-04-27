import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Filter out and suppress benign environment-specific socket/Vite errors
if (typeof window !== 'undefined') {
  const isBenign = (message: string) => 
    message.includes('WebSocket closed without opened') || 
    message.includes('[vite] failed to connect') ||
    message.includes('socket.io');

  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.message || String(event.reason);
    if (isBenign(message)) {
      event.preventDefault();
      // Fully silent now
    }
  });

  window.addEventListener('error', (event) => {
    const message = event.message || '';
    if (isBenign(message)) {
      event.preventDefault();
      // Fully silent now
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
