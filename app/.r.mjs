import { chromium } from '@playwright/test';
import fs from 'fs';
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
const p = await b.newPage({ ignoreHTTPSErrors: true, locale: 'de-DE' });
const r = await p.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
for (let i = 0; i < 30; i++) { await p.mouse.wheel(0, 4000); await p.waitForTimeout(400); }
await p.waitForLoadState('networkidle').catch(() => {});
fs.writeFileSync(out, await p.evaluate(() => document.body.innerText));
fs.writeFileSync(out + '.html', await p.content());
console.log(r?.status(), (await p.evaluate(() => document.body.innerText)).length);
await b.close();
