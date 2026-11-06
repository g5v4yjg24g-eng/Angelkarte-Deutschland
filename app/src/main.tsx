import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import './design/fonts.css';
import './design/tokens.css';
import './design/base.css';
import { createAppRouter, prefetchPages } from './app/router';
import { providers } from './app/providers';
import { ProvidersProvider } from './ports/providers';
import { setupNativeShell } from './app/nativeShell';

setupNativeShell();

const root = document.getElementById('root');
if (!root) throw new Error('#root fehlt in index.html');

createRoot(root).render(
  <StrictMode>
    <ProvidersProvider value={providers}>
      <RouterProvider router={createAppRouter()} />
    </ProvidersProvider>
  </StrictMode>,
);

// Seiten nach dem Start im Hintergrund nachladen (Start bleibt schlank, offline fehlt trotzdem nichts)
const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1));
window.setTimeout(() => idle(() => void prefetchPages(), { timeout: 2000 }), 500);
