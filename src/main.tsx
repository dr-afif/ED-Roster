import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import '@/app/styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root mount element #root was not found in index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  import.meta.env.MODE !== 'test'
) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl, { updateViaCache: 'none' }).catch(() => {
      // Non-fatal: app functions normally without SW if blocked by browser privacy mode.
    });
  });
}
