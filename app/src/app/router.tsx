import { createBrowserRouter } from 'react-router';
import { AppShell } from './AppShell';
import { RouteError } from './RouteError';
import { NotFound } from './NotFound';
import { MapPage } from '../features/map/MapPage';
import { CatchesPage } from '../features/catches/CatchesPage';
import { StatsPage } from '../features/stats/StatsPage';
import { MorePage } from '../features/more/MorePage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { AboutPage } from '../features/about/AboutPage';
import { BackupPage } from '../features/backup/BackupPage';

export const routes = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      {
        errorElement: <RouteError />,
        children: [
          { index: true, element: <MapPage /> },
          { path: 'fangbuch', element: <CatchesPage /> },
          { path: 'statistik', element: <StatsPage /> },
          { path: 'mehr', element: <MorePage /> },
          { path: 'mehr/einstellungen', element: <SettingsPage /> },
          { path: 'mehr/info', element: <AboutPage /> },
          { path: 'mehr/daten', element: <BackupPage /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
];

export function createAppRouter() {
  // BASE_URL endet auf "/"; der Router erwartet den Pfad ohne abschließenden Schrägstrich.
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';
  return createBrowserRouter(routes, { basename });
}
