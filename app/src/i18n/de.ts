// Alle UI-Texte zentral (CLAUDE.md). Später i18n-fähig; im MVP nur Deutsch.
export const de = {
  app: {
    name: 'Fangpunkt',
    tagline: 'Gewässer finden. Stellen merken. Fänge festhalten.',
    skipIntro: 'Intro überspringen',
  },
  nav: {
    label: 'Hauptnavigation',
    map: 'Karte',
    catches: 'Fangbuch',
    stats: 'Statistik',
    more: 'Mehr',
  },
  status: {
    offline: 'Offline',
    offlineHint:
      'Keine Internetverbindung. Gespeicherte Daten bleiben nutzbar; Karte und Wetter brauchen Netz.',
  },
  update: {
    available: 'Eine neue Version von Fangpunkt ist bereit.',
    reload: 'Jetzt aktualisieren',
    later: 'Später',
    offlineReady: 'Fangpunkt ist jetzt auch ohne Internet startbar.',
  },
  common: {
    close: 'Schließen',
    back: 'Zurück',
    comingIn: (milestone: string) => `In Arbeit · Meilenstein ${milestone}`,
    inProgress: 'In Arbeit',
  },
  map: {
    title: 'Karte',
    emptyTitle: 'Die Deutschlandkarte entsteht gerade',
    emptyText:
      'Hier erscheinen bald alle Gewässer in Deutschland, deine Angelstellen und Stege. Ein Tipp auf die Karte legt dann direkt eine Markierung an.',
  },
  catches: {
    title: 'Fangbuch',
    emptyTitle: 'Noch keine Fänge',
    emptyText:
      'Hier sammelst du Fänge, Fischkontakte und Fehlbisse – auch ohne Internet. Die Erfassung wird gerade gebaut.',
  },
  stats: {
    title: 'Statistik',
    emptyTitle: 'Noch nichts auszuwerten',
    emptyText: 'Sobald du Fänge erfasst hast, siehst du hier Arten, Gewässer, Köder und Verläufe.',
  },
  more: {
    title: 'Mehr',
    regulations: 'Fischereirecht NRW',
    regulationsHint: 'Schonzeiten, Mindestmaße, Erlaubnisse',
    backup: 'Daten & Sicherung',
    backupHint: 'Export, Import, Speicher',
    settings: 'Einstellungen',
    settingsHint: 'Darstellung',
    about: 'Über Fangpunkt & Quellen',
    aboutHint: 'Version, Datenquellen, Lizenzen',
  },
  settings: {
    title: 'Einstellungen',
    theme: 'Darstellung',
    themeSystem: 'Wie System',
    themeLight: 'Hell',
    themeDark: 'Dunkel',
    themeHint: 'Wird nur auf diesem Gerät gespeichert.',
  },
  about: {
    title: 'Über Fangpunkt',
    version: (v: string) => `Version ${v}`,
    privacyTitle: 'Datenschutz',
    privacyText:
      'Fangpunkt speichert deine Fänge und Markierungen nur auf diesem Gerät. Es gibt kein Konto, kein Tracking und keine Werbung.',
    sourcesTitle: 'Quellen & Lizenzen',
    sources: [
      { name: 'Schriften Inter und Fraunces', license: 'SIL Open Font License 1.1' },
      { name: 'Kartendaten (ab Kartenmodul)', license: '© OpenStreetMap-Mitwirkende, ODbL 1.0' },
    ],
    legalNote:
      'Fangpunkt ersetzt keine Rechtsauskunft. Maßgeblich sind die amtlichen Texte und dein Erlaubnisschein.',
  },
  notFound: {
    title: 'Seite nicht gefunden',
    text: 'Diese Ansicht gibt es nicht (mehr).',
    action: 'Zur Karte',
  },
  error: {
    title: 'Hier ist etwas schiefgelaufen',
    text: 'Deine gespeicherten Daten sind davon nicht betroffen. Lade die Ansicht neu.',
    action: 'Neu laden',
  },
} as const;
