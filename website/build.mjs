// Website fangpunkt.com (Entscheidung Nutzer 2026-11-03: App bleibt unter github.io, die Domain trägt nur eine
// kleine Website). Statisches HTML ohne Fremdserver, ohne Cookies, ohne Zählung. Die Datenschutz-Abschnitte zur
// App kommen aus derselben Quelle wie in der App (app/src/i18n/de.ts → privacy), damit beides nie auseinanderläuft.
// Aufruf: node --experimental-strip-types website/build.mjs  →  website/dist
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { de } from '../app/src/i18n/de.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'dist');
const cfg = JSON.parse(readFileSync(join(here, 'site.config.json'), 'utf8'));
const p = de.privacy;

if (!cfg.controllerName && !process.env.ALLOW_DRAFT) {
  console.error('site.config.json: controllerName fehlt (Verantwortlicher für die Datenschutzerklärung).');
  process.exit(1);
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const mail = `<a href="mailto:${esc(cfg.email)}">${esc(cfg.email)}</a>`;
const controller = cfg.controllerName ? esc(cfg.controllerName) : '<mark>[Name fehlt]</mark>';
const stand = new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });

function page({ path, title, description, body }) {
  const depth = path.split('/').filter(Boolean).length;
  const root = depth ? '../'.repeat(depth) : './';
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#0b2a33">
<link rel="icon" href="${root}favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${root}apple-touch-icon.png">
<link rel="stylesheet" href="${root}style.css">
</head>
<body>
<header class="top">
  <a class="brand" href="${root}"><img src="${root}favicon.svg" alt="" width="32" height="32"> Fangpunkt</a>
  <nav aria-label="Hauptmenü">
    <a href="${root}datenschutz/">Datenschutz</a>
    <a href="${root}kontakt/">Kontakt</a>
  </nav>
</header>
<main>
${body}
</main>
<footer>
  <p>Fangpunkt ist ein privates, nicht kommerzielles Projekt. <a href="${root}datenschutz/">Datenschutz</a> · <a href="${root}kontakt/">Kontakt</a></p>
</footer>
</body>
</html>
`;
}

const appButton = `<a class="button" href="${esc(cfg.appUrl)}">App im Browser öffnen</a>`;
const storeButton = cfg.appStoreUrl
  ? `<a class="button secondary" href="${esc(cfg.appStoreUrl)}">Im App Store laden</a>`
  : `<p class="muted">Die iPhone-App für den App Store ist in Vorbereitung.</p>`;

const home = page({
  path: '',
  title: 'Fangpunkt – Angel-App für Deutschland',
  description: 'Fangbuch, Karte, Wetter und Regeln zum Angeln in Deutschland – privat, ohne Werbung, Daten bleiben auf dem Gerät.',
  body: `<section class="hero">
  <img src="favicon.svg" alt="" width="96" height="96">
  <h1>Fangpunkt</h1>
  <p class="lead">Die Angel-App für Deutschland: Fangbuch, Gewässerkarte, Wetter und Regeln deines Bundeslands – ohne Werbung, deine Daten bleiben auf deinem Gerät.</p>
  <div class="actions">${appButton}</div>
  ${storeButton}
</section>
<section>
  <h2>Was Fangpunkt kann</h2>
  <ul class="features">
    <li><strong>Fangbuch</strong> mit Fotos, Sessions, Statistik und Wetter am Fang</li>
    <li><strong>Karte</strong> mit Gewässern in ganz Deutschland und deinen Spots</li>
    <li><strong>Wetter</strong> mit 10-Tage-Vorhersage, Luftdruck, Pegeln und amtlichen Warnungen</li>
    <li><strong>Regeln</strong> wie Schonzeiten und Mindestmaße je Bundesland (keine Rechtsauskunft)</li>
    <li><strong>Knoten, Montagen und Köderführung</strong> als Schritt-für-Schritt-Animation</li>
  </ul>
  <p class="muted">Tipp: Im Browser über „Teilen → Zum Home-Bildschirm“ wie eine App nutzen.</p>
</section>
`,
});

const privacy = page({
  path: 'datenschutz/',
  title: 'Datenschutz – Fangpunkt',
  description: 'Datenschutzerklärung für die App Fangpunkt und die Website fangpunkt.com.',
  body: `<article class="prose">
<h1>Datenschutzerklärung</h1>
<p class="muted">Stand: ${esc(stand)}. Gilt für die App Fangpunkt (Web-App und iPhone-App) und diese Website.</p>

<h2>Verantwortlich</h2>
<p>${controller}<br>E-Mail: ${mail}</p>

<h2>Kurz gesagt</h2>
<p>${esc(p.intro)}</p>

<h2>${esc(p.localTitle)}</h2>
<ul>${p.local.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>

<h2>${esc(p.locationTitle)}</h2>
<p>${esc(p.location)}</p>

<h2>${esc(p.serversTitle)}</h2>
<p>${esc(p.serversIntro)}</p>
<ul>${p.servers.map((s) => `<li><strong>${esc(s.name)}</strong> ${esc(s.what)}</li>`).join('')}</ul>

<h2>${esc(p.linksTitle)}</h2>
<p>${esc(p.links)}</p>

<h2>Diese Website</h2>
<p>fangpunkt.com wird über GitHub Pages (GitHub, Inc., USA) ausgeliefert. Beim Aufruf verarbeitet GitHub technisch deine IP-Adresse und Angaben deines Browsers, um die Seite auszuliefern und vor Missbrauch zu schützen. Die Website setzt keine Cookies, lädt keine Inhalte von anderen Servern und zählt keine Besuche.</p>

<h2>E-Mail an uns</h2>
<p>Schreibst du an ${mail}, verwenden wir deine Adresse und Nachricht nur, um dir zu antworten, und löschen sie, wenn sie dafür nicht mehr gebraucht werden.</p>

<h2>Deine Rechte</h2>
<p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. Daten, die nur auf deinem Gerät liegen, kennen wir nicht – du kannst sie selbst sichern und löschen. Für alles andere genügt eine E-Mail an ${mail}.</p>
</article>
`,
});

const contact = page({
  path: 'kontakt/',
  title: 'Kontakt – Fangpunkt',
  description: 'Kontakt und Hilfe zur App Fangpunkt.',
  body: `<article class="prose">
<h1>Kontakt &amp; Hilfe</h1>
<p>Fragen, Fehler oder Ideen zu Fangpunkt? Schreib uns: ${mail}</p>
<h2>Häufige Fragen</h2>
<h3>Wo sind meine Daten?</h3>
<p>Nur auf deinem Gerät. Sichere sie regelmäßig unter <em>Mehr → Daten &amp; Sicherung</em>.</p>
<h3>Ich habe ein neues Handy.</h3>
<p>Auf dem alten Gerät eine Sicherung erstellen, auf dem neuen unter <em>Mehr → Daten &amp; Sicherung</em> importieren.</p>
<h3>Sind die Regeln verbindlich?</h3>
<p>Nein. Fangpunkt gibt keine Rechtsauskunft. Maßgeblich sind die amtlichen Texte deines Bundeslands und die Bedingungen deines Gewässers.</p>
</article>
`,
});

const notFound = page({
  path: '',
  title: 'Seite nicht gefunden – Fangpunkt',
  description: 'Diese Seite gibt es nicht.',
  body: `<article class="prose"><h1>Seite nicht gefunden</h1><p><a href="/">Zur Startseite</a></p></article>`,
});

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'datenschutz'), { recursive: true });
mkdirSync(join(out, 'kontakt'), { recursive: true });
writeFileSync(join(out, 'index.html'), home);
writeFileSync(join(out, 'datenschutz', 'index.html'), privacy);
writeFileSync(join(out, 'kontakt', 'index.html'), contact);
writeFileSync(join(out, '404.html'), notFound.replaceAll('href="./', 'href="/'));
writeFileSync(join(out, 'CNAME'), `${cfg.domain}\n`);
writeFileSync(join(out, '.nojekyll'), '');
copyFileSync(join(here, 'style.css'), join(out, 'style.css'));
copyFileSync(join(here, '../app/public/icons/favicon.svg'), join(out, 'favicon.svg'));
copyFileSync(join(here, '../app/public/icons/apple-touch-icon.png'), join(out, 'apple-touch-icon.png'));
console.log(`Website gebaut: ${out}${cfg.controllerName ? '' : ' (ENTWURF: Name fehlt)'}`);
