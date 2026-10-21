import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import './design/fonts.css';
import './design/tokens.css';
import './design/base.css';
import { createAppRouter } from './app/router';

const root = document.getElementById('root');
if (!root) throw new Error('#root fehlt in index.html');

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={createAppRouter()} />
  </StrictMode>,
);
