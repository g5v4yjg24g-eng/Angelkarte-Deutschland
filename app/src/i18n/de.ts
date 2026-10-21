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
    storedTitle: (n: number) => (n === 1 ? '1 Eintrag gespeichert' : `${n} Einträge gespeichert`),
    storedText:
      'Deine Einträge sind sicher auf diesem Gerät gespeichert und in jeder Sicherung enthalten. Die Liste zum Ansehen und Bearbeiten wird gerade gebaut.',
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
  backup: {
    title: 'Daten & Sicherung',
    storageTitle: 'Speicher auf diesem Gerät',
    storageIntro:
      'Deine Fänge, Orte und Fotos liegen nur in diesem Browser. Browser können solche Daten bei Platzmangel oder nach längerer Nichtnutzung löschen – installiere Fangpunkt und sichere regelmäßig.',
    persisted: 'Dauerhafter Speicher ist aktiv.',
    notPersisted: 'Dauerhafter Speicher ist nicht bestätigt.',
    persistUnsupported: 'Dieser Browser bietet keinen dauerhaften Speicher an.',
    persistAction: 'Dauerhaft speichern anfragen',
    persistDenied:
      'Der Browser hat abgelehnt. Installiere Fangpunkt als App, dann wird der Speicher meist dauerhaft.',
    usage: (used: string, quota: string) => `${used} von ${quota} belegt`,
    counts: (c: { catches: number; places: number; sessions: number; photos: number }) =>
      `${c.catches} Einträge im Fangbuch · ${c.places} Orte · ${c.sessions} Sessions · ${c.photos} Fotos`,
    exportTitle: 'Sicherung erstellen',
    lastBackup: (d: string) => `Letzte Sicherung: ${d}`,
    neverBackedUp: 'Noch keine Sicherung erstellt.',
    changes: (n: number) =>
      n === 1 ? '1 Änderung seit der letzten Sicherung' : `${n} Änderungen seit der letzten Sicherung`,
    exportJson: 'Sicherung ohne Fotos (.json)',
    exportZip: 'Sicherung mit Fotos (.zip)',
    exportHint:
      'Speichere die Datei an einem sicheren Ort, z. B. in deiner Cloud oder per Mail an dich selbst.',
    exportDone: (name: string) => `Sicherung „${name}" wurde erstellt.`,
    importTitle: 'Sicherung wiederherstellen',
    importHint: 'Fangpunkt-Sicherungen (.json, .zip) und Sicherungen der bisherigen Angelkarte-App (.json).',
    chooseFile: 'Datei auswählen',
    reading: 'Datei wird geprüft …',
    previewTitle: 'Was würde importiert?',
    tables: {
      catches: 'Fangbuch',
      places: 'Orte',
      sessions: 'Sessions',
      baitPresets: 'Köder-Favoriten',
      photos: 'Fotos',
    },
    colNew: 'neu',
    colSame: 'gleich',
    colConflict: 'abweichend',
    invalidTitle: (n: number) => `${n} Datensätze sind ungültig und werden übersprungen`,
    strategyTitle: 'Wenn ein Datensatz auf dem Gerät und in der Datei abweicht',
    strategies: {
      keepNewer: { label: 'Neuere Fassung behalten', hint: 'Empfohlen. Vergleicht das Änderungsdatum.' },
      fileWins: {
        label: 'Fassung aus der Datei übernehmen',
        hint: 'Überschreibt abweichende Einträge auf dem Gerät.',
      },
      onlyNew: { label: 'Nur neue Einträge hinzufügen', hint: 'Vorhandenes bleibt unverändert.' },
    },
    importAction: (n: number) => (n === 1 ? '1 Datensatz importieren' : `${n} Datensätze importieren`),
    nothingToImport: 'Alles aus dieser Datei ist bereits auf dem Gerät.',
    cancel: 'Abbrechen',
    importDone: (n: number) =>
      `${n} Datensätze importiert. Vorher wurde automatisch ein Zwischenstand gesichert.`,
    undoTitle: 'Letzten Import rückgängig machen',
    undoHint: (d: string) => `Stellt den Stand vom ${d} wieder her (vor dem letzten Import).`,
    undoAction: 'Stand vor dem Import wiederherstellen',
    undoConfirm: 'Alle Änderungen seit diesem Zeitpunkt gehen verloren. Fortfahren?',
    undoDone: 'Der Stand vor dem Import wurde wiederhergestellt.',
    reminder: (n: number) =>
      n === 1 ? '1 Änderung ist noch nicht gesichert.' : `${n} Änderungen sind noch nicht gesichert.`,
    reminderAction: 'Jetzt sichern',
    reminderLater: 'Später',
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
