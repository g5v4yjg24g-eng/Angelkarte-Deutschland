import { createBrowserRouter } from 'react-router';
import { AppShell } from './AppShell';
import { RouteError } from './RouteError';
import { NotFound } from './NotFound';
import { MapPage } from '../features/map/MapPage';
import { CatchesPage } from '../features/catches/CatchesPage';
import { CatchDetailPage } from '../features/catches/CatchDetailPage';
import { SessionsPage } from '../features/sessions/SessionsPage';
import { SessionDetailPage } from '../features/sessions/SessionDetailPage';
import { SessionReviewPage } from '../features/sessions/review/SessionReviewPage';
import { StatsPage } from '../features/stats/StatsPage';
import { MorePage } from '../features/more/MorePage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { WeatherPage } from '../features/weather/WeatherPage';
import { CalendarPage } from '../features/calendar/CalendarPage';
import { PrivacyPage } from '../features/about/PrivacyPage';
import { BaitPresetsPage } from '../features/baits/BaitPresetsPage';
import { KnotsPage } from '../features/knots/KnotsPage';
import { KnotDetailPage } from '../features/knots/KnotDetailPage';
import { AboutPage } from '../features/about/AboutPage';
import { LazyBackupPage } from '../features/backup/LazyBackupPage';
import { LazyAccountPage } from '../features/account/LazyAccountPage';
import { LawPage } from '../features/law/LawPage';
import { StateLawPage } from '../features/law/StateLawPage';

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
          { path: 'fangbuch/sessions', element: <SessionsPage /> },
          { path: 'fangbuch/sessions/:id', element: <SessionDetailPage /> },
          { path: 'fangbuch/sessions/:id/rueckblick', element: <SessionReviewPage /> },
          { path: 'fangbuch/:id', element: <CatchDetailPage /> },
          { path: 'wetter', element: <WeatherPage /> },
          { path: 'wetter/kalender', element: <CalendarPage /> },
          { path: 'statistik', element: <StatsPage /> },
          { path: 'mehr', element: <MorePage /> },
          { path: 'mehr/einstellungen', element: <SettingsPage /> },
          { path: 'mehr/koeder', element: <BaitPresetsPage /> },
          { path: 'mehr/knoten', element: <KnotsPage /> },
          { path: 'mehr/knoten/:knot', element: <KnotDetailPage /> },
          { path: 'mehr/info', element: <AboutPage /> },
          { path: 'mehr/datenschutz', element: <PrivacyPage /> },
          { path: 'mehr/daten', element: <LazyBackupPage /> },
          { path: 'mehr/konto', element: <LazyAccountPage /> },
          { path: 'mehr/recht', element: <LawPage /> },
          { path: 'mehr/recht/:state', element: <StateLawPage /> },
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
