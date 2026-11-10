// Seiten werden erst geladen, wenn man sie öffnet (Phase 5, Freigabe Nutzer 2026-11-06): kleinerer Start.
// Der Router wartet auf den Code, bevor er wechselt – kein leerer Zwischenzustand. Die Karte (Startseite) ist sofort da.
import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell, RootLayout } from './AppShell';
import { ADMIN_BASE } from '../features/moderation/admin/adminPaths';
import { LegacyModRedirect } from '../features/moderation/admin/LegacyModRedirect';
import { RouteError } from './RouteError';
import { NotFound } from './NotFound';
import { MapPage } from '../features/map/MapPage';

const loaders: (() => Promise<unknown>)[] = [];

/** Seite bei Bedarf laden: Modul und Name der exportierten Komponente */
const page = <M,>(load: () => Promise<M>, pick: (m: M) => ComponentType) => {
  loaders.push(load);
  return async () => ({ Component: pick(await load()) });
};

/**
 * Alle Seiten im Hintergrund nachladen, sobald das Gerät nach dem Start Luft hat – damit jede Seite auch ohne Netz
 * aufgeht, selbst wenn der Service Worker (noch) nichts vorhält. Fehler (z. B. schon offline) sind egal.
 */
export function prefetchPages(): Promise<void> {
  return Promise.allSettled(loaders.map((load) => load())).then(() => {
    window.__fangpunktPagesLoaded = true;
  });
}

export const routes = [
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      // Admin-Bereich (Phase 1, Wunsch Nutzer 2026-11-10): eigener Rahmen mit Admin-Leiste statt der normalen
      {
        path: 'moderation',
        lazy: page(
          () => import('../features/moderation/admin/AdminShell'),
          (m) => m.AdminShell,
        ),
        errorElement: <RouteError />,
        children: [
          {
            index: true,
            lazy: page(
              () => import('../features/moderation/admin/AdminOverviewPage'),
              (m) => m.AdminOverviewPage,
            ),
          },
          {
            path: 'meldungen',
            lazy: page(
              () => import('../features/moderation/admin/ModerationPage'),
              (m) => m.ModerationPage,
            ),
          },
          {
            path: 'meldungen/:id',
            lazy: page(
              () => import('../features/moderation/admin/ModReportPage'),
              (m) => m.ModReportPage,
            ),
          },
          {
            path: 'nutzer',
            lazy: page(
              () => import('../features/moderation/admin/ModUsersPage'),
              (m) => m.ModUsersPage,
            ),
          },
          {
            path: 'nutzer/:uid',
            lazy: page(
              () => import('../features/moderation/admin/ModUserPage'),
              (m) => m.ModUserPage,
            ),
          },
          {
            path: 'verwaltung',
            lazy: page(
              () => import('../features/moderation/admin/AdminSettingsPage'),
              (m) => m.AdminSettingsPage,
            ),
          },
          {
            path: 'verwaltung/nachrichten',
            lazy: page(
              () => import('../features/moderation/admin/SystemMessagesPage'),
              (m) => m.SystemMessagesPage,
            ),
          },
          {
            path: 'verwaltung/namen',
            lazy: page(
              () => import('../features/moderation/admin/BlockedNamesPage'),
              (m) => m.BlockedNamesPage,
            ),
          },
          {
            path: 'verwaltung/protokoll',
            lazy: page(
              () => import('../features/moderation/admin/AdminLogPage'),
              (m) => m.AdminLogPage,
            ),
          },
          {
            path: 'verwaltung/statistik',
            lazy: page(
              () => import('../features/moderation/admin/AdminStatsPage'),
              (m) => m.AdminStatsPage,
            ),
          },
          {
            path: 'verwaltung/regeln',
            lazy: page(
              () => import('../features/moderation/admin/RulesAdminPage'),
              (m) => m.RulesAdminPage,
            ),
          },
          {
            path: 'verwaltung/einsprueche',
            lazy: page(
              () => import('../features/moderation/admin/AppealsAdminPage'),
              (m) => m.AppealsAdminPage,
            ),
          },
          {
            path: 'verwaltung/rollen',
            lazy: page(
              () => import('../features/moderation/admin/RolesPage'),
              (m) => m.RolesPage,
            ),
          },
          { path: '*', element: <Navigate to={ADMIN_BASE} replace /> },
        ],
      },
      {
        element: <AppShell />,
        children: [
          {
            errorElement: <RouteError />,
            children: [
              { index: true, element: <MapPage /> },
              {
                path: 'fangbuch',
                lazy: page(
                  () => import('../features/catches/CatchesPage'),
                  (m) => m.CatchesPage,
                ),
              },
              {
                path: 'fangbuch/sessions',
                lazy: page(
                  () => import('../features/sessions/SessionsPage'),
                  (m) => m.SessionsPage,
                ),
              },
              {
                path: 'fangbuch/sessions/:id',
                lazy: page(
                  () => import('../features/sessions/SessionDetailPage'),
                  (m) => m.SessionDetailPage,
                ),
              },
              {
                path: 'fangbuch/sessions/:id/rueckblick',
                lazy: page(
                  () => import('../features/sessions/review/SessionReviewPage'),
                  (m) => m.SessionReviewPage,
                ),
              },
              {
                path: 'fangbuch/sessions/:id/einladen',
                lazy: page(
                  () => import('../features/sessions/group/InvitePage'),
                  (m) => m.InvitePage,
                ),
              },
              {
                path: 'fangbuch/:id',
                lazy: page(
                  () => import('../features/catches/CatchDetailPage'),
                  (m) => m.CatchDetailPage,
                ),
              },
              {
                path: 'wetter',
                lazy: page(
                  () => import('../features/weather/WeatherPage'),
                  (m) => m.WeatherPage,
                ),
              },
              {
                path: 'wetter/kalender',
                lazy: page(
                  () => import('../features/calendar/CalendarPage'),
                  (m) => m.CalendarPage,
                ),
              },
              {
                path: 'statistik',
                lazy: page(
                  () => import('../features/stats/StatsPage'),
                  (m) => m.StatsPage,
                ),
              },
              {
                path: 'profil',
                lazy: page(
                  () => import('../features/profile/ProfilePage'),
                  (m) => m.ProfilePage,
                ),
              },
              {
                path: 'profil/bearbeiten',
                lazy: page(
                  () => import('../features/profile/EditProfilePage'),
                  (m) => m.EditProfilePage,
                ),
              },
              {
                path: 'profil/neu',
                lazy: page(
                  () => import('../features/profile/NewPostPage'),
                  (m) => m.NewPostPage,
                ),
              },
              {
                path: 'profil/beitrag/:id',
                lazy: page(
                  () => import('../features/profile/PostPage'),
                  (m) => m.PostPage,
                ),
              },
              {
                path: 'profil/freunde',
                lazy: page(
                  () => import('../features/friends/FriendsPage'),
                  (m) => m.FriendsPage,
                ),
              },
              {
                path: 'profil/spots',
                lazy: page(
                  () => import('../features/spots/SharedSpotsPage'),
                  (m) => m.SharedSpotsPage,
                ),
              },
              {
                path: 'profil/erfolge',
                lazy: page(
                  () => import('../features/achievements/AchievementsPage'),
                  (m) => m.AchievementsPage,
                ),
              },
              {
                path: 'profil/nutzer/:username',
                lazy: page(
                  () => import('../features/profile/UserProfilePage'),
                  (m) => m.UserProfilePage,
                ),
              },
              {
                path: 'profil/nutzer/:username/beitraege',
                lazy: page(
                  () => import('../features/profile/UserPostsPage'),
                  (m) => m.UserPostsPage,
                ),
              },
              {
                path: 'profil/gespeichert',
                lazy: page(
                  () => import('../features/feed/SavedPostsPage'),
                  (m) => m.SavedPostsPage,
                ),
              },
              {
                path: 'profil/spots/teilen/:placeId',
                lazy: page(
                  () => import('../features/spots/ShareSpotPage'),
                  (m) => m.ShareSpotPage,
                ),
              },
              {
                path: 'feed',
                lazy: page(
                  () => import('../features/feed/FeedPage'),
                  (m) => m.FeedPage,
                ),
              },
              {
                path: 'feed/entdecken',
                lazy: async () => {
                  const { FeedPage } = await import('../features/feed/FeedPage');
                  return { Component: () => <FeedPage mode="discover" /> };
                },
              },
              {
                path: 'mehr',
                lazy: page(
                  () => import('../features/more/MorePage'),
                  (m) => m.MorePage,
                ),
              },
              {
                path: 'mehr/einstellungen',
                lazy: page(
                  () => import('../features/settings/SettingsPage'),
                  (m) => m.SettingsPage,
                ),
              },
              {
                path: 'mehr/koeder',
                lazy: page(
                  () => import('../features/baits/BaitPresetsPage'),
                  (m) => m.BaitPresetsPage,
                ),
              },
              {
                path: 'mehr/knoten',
                lazy: page(
                  () => import('../features/knots/KnotsPage'),
                  (m) => m.KnotsPage,
                ),
              },
              {
                path: 'mehr/knoten/:knot',
                lazy: page(
                  () => import('../features/knots/KnotDetailPage'),
                  (m) => m.KnotDetailPage,
                ),
              },
              {
                path: 'mehr/montagen',
                lazy: page(
                  () => import('../features/knots/RigsPage'),
                  (m) => m.RigsPage,
                ),
              },
              {
                path: 'mehr/montagen/:rig',
                lazy: page(
                  () => import('../features/knots/RigDetailPage'),
                  (m) => m.RigDetailPage,
                ),
              },
              {
                path: 'mehr/koederfuehrung',
                lazy: page(
                  () => import('../features/knots/RetrievesPage'),
                  (m) => m.RetrievesPage,
                ),
              },
              {
                path: 'mehr/koederfuehrung/:retrieve',
                lazy: page(
                  () => import('../features/knots/RetrieveDetailPage'),
                  (m) => m.RetrieveDetailPage,
                ),
              },
              {
                path: 'mehr/info',
                lazy: page(
                  () => import('../features/about/AboutPage'),
                  (m) => m.AboutPage,
                ),
              },
              {
                path: 'mehr/datenschutz',
                lazy: page(
                  () => import('../features/about/PrivacyPage'),
                  (m) => m.PrivacyPage,
                ),
              },
              // Einspruch gegen eine Sperre (Link aus der Sperr-Mail, ohne Anmeldung)
              {
                path: 'einspruch',
                lazy: page(
                  () => import('../features/moderation/AppealPage'),
                  (m) => m.AppealPage,
                ),
              },
              {
                path: 'mehr/regeln',
                lazy: page(
                  () => import('../features/moderation/Rules'),
                  (m) => m.RulesPage,
                ),
              },
              // früherer Ort des Moderationsbereichs (auch Links in den Meldungs-Mails): weiter in den Admin-Bereich
              { path: 'mehr/moderation', element: <Navigate to={ADMIN_BASE} replace /> },
              { path: 'mehr/moderation/nutzer/:uid', element: <LegacyModRedirect to="nutzer" /> },
              { path: 'mehr/moderation/:id', element: <LegacyModRedirect to="meldungen" /> },
              {
                path: 'mehr/daten',
                lazy: page(
                  () => import('../features/backup/BackupPage'),
                  (m) => m.BackupPage,
                ),
              },
              {
                path: 'mehr/konto',
                lazy: page(
                  () => import('../features/account/AccountPage'),
                  (m) => m.AccountPage,
                ),
              },
              {
                path: 'mehr/recht',
                lazy: page(
                  () => import('../features/law/LawPage'),
                  (m) => m.LawPage,
                ),
              },
              {
                path: 'mehr/recht/:state',
                lazy: page(
                  () => import('../features/law/StateLawPage'),
                  (m) => m.StateLawPage,
                ),
              },
              { path: '*', element: <NotFound /> },
            ],
          },
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
