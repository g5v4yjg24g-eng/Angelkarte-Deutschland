// Echte Screenshots der Live-App (GitHub Pages) mit klar gekennzeichneten BEISPIELDATEN.
// Die Daten sind ausgedacht und dienen nur der Darstellung; jedes Motiv, das sie zeigt, trägt den Vermerk „Beispieldaten“.
// Aufruf (Repo-Root): node marketing/tools/screenshots.mjs  → marketing/screenshots/*.png
import { mkdirSync } from 'node:fs';
import { chromium } from '../../node_modules/.pnpm/node_modules/playwright/index.mjs';
import { BASE, HOME, demoData, seed, waitApp } from './demo.mjs';

const OUT = new URL('../screenshots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

async function run(theme) {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, locale: 'de-DE', timezoneId: 'Europe/Berlin',
    geolocation: HOME, permissions: ['geolocation'], colorScheme: theme, serviceWorkers: 'block',
  });
  const page = await ctx.newPage();
  const go = async (path) => {
    await page.goto(new URL(path, BASE).href);
    await waitApp(page);
  };
  const shot = (name) => page.screenshot({ path: `${OUT}${theme}-${name}.png` });

  await go('./fangbuch');
  await seed(page, demoData());
  await page.evaluate(() => localStorage.setItem('fangpunkt.locHintSeen', '1'));
  await go('./fangbuch');
  // Wetter am Fang lädt im Hintergrund nach (echte Modellwerte von Open-Meteo)
  await page.waitForTimeout(25000);
  // Das Nachladen ändert die Einträge; danach als gesichert markieren, damit die Erinnerung nicht im Bild steht
  await seed(page, { catches: [], sessions: [], places: [], trips: [] });
  await go('./fangbuch');
  await page.waitForTimeout(1500);
  await shot('fangbuch');
  // Ausschnitt ab der Fangliste (Karussell „Fänge nach Gewässern“ zeigt nur den oberen Teil des Bildschirms)
  await page.getByText(/^\d+ Einträge$/).first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -64));
  await page.waitForTimeout(1000);
  await shot('fangbuch-gewaesser');
  await page.evaluate(() => window.scrollTo(0, 0));

  await page.locator('main a[href*="/fangbuch/demo-c"]').first().click();
  await page.waitForTimeout(2500);
  await shot('fang-detail');

  await go('./statistik');
  await page.waitForTimeout(2000);
  await shot('statistik');
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(800);
  await shot('statistik-2');

  await go('./wetter');
  // Lädt die Vorhersage nicht (z. B. Open-Meteo antwortet 429), bleiben die vorhandenen Wetter-Bilder stehen
  const forecast = await page.getByText(/Die nächsten Tage/i).first().waitFor({ timeout: 30000 }).then(() => true, () => false);
  if (!forecast) console.log('Wetter übersprungen: Vorhersage nicht geladen');
  else {
    await page.waitForTimeout(3000);
    await shot('wetter');
    const toHeading = async (re, name) => {
      await page.getByText(re).first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await page.evaluate(() => window.scrollBy(0, -70));
      await page.waitForTimeout(1000);
      await shot(name);
    };
    await toHeading(/Luftdruck-Verlauf/i, 'wetter-luftdruck');
    await toHeading(/Pegel in der Nähe/i, 'wetter-pegel');
    await toHeading(/^Beißfenster$/i, 'wetter-beissfenster');
    await toHeading(/Aus deinem Fangbuch/i, 'wetter-bisse');
  }

  await go('./wetter/kalender');
  await page.waitForTimeout(2500);
  await shot('kalender');

  await go('./mehr/recht');
  await page.waitForTimeout(1500);
  await shot('recht');

  await go('./');
  await page.waitForFunction(() => window.__fangpunktMap?.loaded(), null, { timeout: 30000 });
  await page.evaluate(() => window.__fangpunktMap.jumpTo({ center: [8.1095, 51.4832], zoom: 13.9 }));
  await page.waitForTimeout(7000);
  await shot('karte');
  await page.evaluate(() => localStorage.setItem('fangpunkt.heatmap', '1'));
  await go('./');
  await page.waitForFunction(() => window.__fangpunktMap?.loaded(), null, { timeout: 30000 });
  await page.evaluate(() => window.__fangpunktMap.jumpTo({ center: [8.1095, 51.4832], zoom: 13.9 }));
  await page.waitForTimeout(7000);
  await shot('karte-heatmap');
  await page.evaluate(() => localStorage.removeItem('fangpunkt.heatmap'));

  await browser.close();
}

for (const theme of (process.env.THEMES ?? 'light,dark').split(',')) {
  await run(theme);
  console.log('fertig:', theme);
}
