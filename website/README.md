# Website fangpunkt.com

Kleine statische Website (Entscheidung Nutzer 2026-11-03): Startseite mit Link zur App, Datenschutzerklärung, Kontakt.
Die **App bleibt** unter `g5v4yjg24g-eng.github.io/Angelkarte-Deutschland/` – ein Umzug würde die im Browser gespeicherten Daten
unerreichbar machen (Speicher je Adresse).

- Quelle hier, ausgeliefert über das Repo `g5v4yjg24g-eng/fangpunkt-website` (GitHub Pages, eigene Domain über `CNAME`).
- **Nie** dem Repo `g5v4yjg24g-eng.github.io` eine eigene Domain geben – sonst leitet GitHub auch die App um.
- Datenschutz-Abschnitte zur App kommen aus `app/src/i18n/de.ts` (`privacy`). Ändert sich die Datenschutzseite der App,
  Website neu bauen und veröffentlichen.
- Keine Fremdserver, keine Cookies, keine Zählung.
- Einstellungen in `site.config.json` (`controllerName` = Verantwortlicher, Pflicht; `appStoreUrl` sobald vorhanden).

```
node --experimental-strip-types website/build.mjs    # → website/dist
```

DNS bei INWX (gesetzt 2026-11-03, geprüft): A 185.199.108–111.153, AAAA 2606:50c0:8000–8003::153, CNAME www → g5v4yjg24g-eng.github.io.
