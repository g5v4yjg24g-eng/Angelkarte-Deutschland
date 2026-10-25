import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from './fixtures';
import { collectErrors, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });

const SUPABASE = 'https://sgnyymciwnwjgvojptwu.supabase.co';
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const EXP = Math.floor(Date.now() / 1000) + 3600;
const TOKEN = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u-1', exp: EXP, role: 'authenticated', aud: 'authenticated', email: 'max@example.de' })}.sig`;

/** Nachgebildeter Supabase-Server: Auth (Code) und REST (profiles, Funktionen) – der echte wird nie gerufen. */
async function fakeSupabase(page: Page) {
  const calls: string[] = [];
  let profile: { id: string; username: string; display_name: string } | null = null;
  const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'max@example.de' };
  const exp = EXP;
  const token = TOKEN;
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  await page.route(`${SUPABASE}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const key = `${req.method()} ${url.pathname}`;
    calls.push(key);
    const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    switch (key) {
      case 'POST /auth/v1/otp':
        return json(route, {});
      case 'POST /auth/v1/verify': {
        const body = req.postDataJSON() as { token: string };
        if (body.token !== '123456')
          return json(
            route,
            { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' },
            403,
          );
        return json(route, {
          access_token: token,
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: exp,
          refresh_token: 'r-1',
          user,
        });
      }
      case 'GET /auth/v1/user':
        return json(route, user);
      case 'POST /auth/v1/logout':
        return route.fulfill({ status: 204 });
      case 'GET /rest/v1/profiles':
        return json(route, single ? profile : profile ? [profile] : []);
      case 'POST /rest/v1/rpc/username_available': {
        const { name } = req.postDataJSON() as { name: string };
        return json(route, name !== 'hecht');
      }
      case 'POST /rest/v1/profiles': {
        const b = req.postDataJSON() as { id: string; username: string; display_name: string };
        profile = { id: b.id, username: b.username, display_name: b.display_name };
        return json(route, single ? profile : [profile], 201);
      }
      case 'PATCH /rest/v1/profiles': {
        const b = req.postDataJSON() as { display_name: string };
        profile = { ...(profile as NonNullable<typeof profile>), display_name: b.display_name };
        return json(route, single ? profile : [profile]);
      }
      case 'POST /rest/v1/rpc/delete_my_account':
        profile = null;
        return route.fulfill({ status: 204 });
      default:
        return json(route, { message: `nicht nachgebildet: ${key}` }, 404);
    }
  });
  return calls;
}

test('ACC-3: Konto anlegen mit E-Mail-Code, Profil, Anzeigename ändern, Konto löschen', async ({ page }) => {
  const errors = collectErrors(page);
  const calls = await fakeSupabase(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/mehr');
  await waitForApp(page);
  await expect(page.getByRole('link', { name: /^Konto.*Freiwillig/ })).toBeVisible();
  await page.getByRole('link', { name: /^Konto/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Konto' })).toBeVisible();
  expect(calls).toEqual([]); // ohne Anmeldung kein Kontakt zu Supabase

  await page.getByRole('textbox', { name: 'E-Mail-Adresse' }).fill('Max@Example.de');
  await page.getByRole('button', { name: 'Code senden' }).click();
  await expect(page.getByText(/E-Mail an max@example\.de geschickt/)).toBeVisible();
  await page.getByRole('textbox', { name: 'Code aus der E-Mail' }).fill('999999');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByText(/Der Code ist falsch oder abgelaufen/)).toBeVisible();
  await page.getByRole('textbox', { name: 'Code aus der E-Mail' }).fill('123456');
  await page.getByRole('button', { name: 'Anmelden' }).click();

  await expect(page.getByRole('heading', { name: 'Profil anlegen' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Nutzername' }).fill('hecht');
  await expect(page.getByText('Dieser Nutzername ist schon vergeben.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Nutzername' }).fill('zander.max');
  await expect(page.getByText('Frei.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Anzeigename' }).fill('Max');
  await page.getByRole('button', { name: 'Profil speichern' }).click();
  await expect(page.getByText('@zander.max')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(
    await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
      .then((r) =>
        r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
      ),
  ).toEqual([]);

  // Anmeldung bleibt nach dem Neuladen erhalten; Mehr zeigt „Angemeldet“
  await page.goto('/mehr');
  await expect(page.getByRole('link', { name: /^Konto.*Angemeldet/ })).toBeVisible();
  await page.getByRole('link', { name: /^Konto/ }).click();
  await expect(page.getByText('@zander.max')).toBeVisible();

  await page.getByRole('button', { name: 'Anzeigename ändern' }).click();
  await page.getByRole('textbox', { name: 'Anzeigename' }).fill('Max M.');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Max M.')).toBeVisible();

  await page.getByRole('textbox', { name: /deinen Nutzernamen „zander.max“ eingeben/ }).fill('zander.max');
  await page.getByRole('button', { name: 'Konto endgültig löschen' }).click();
  await expect(page.getByText('Dein Konto wurde gelöscht.')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'E-Mail-Adresse' })).toBeVisible();
  expect(calls).toContain('POST /rest/v1/rpc/delete_my_account');
  // keine Fangdaten an Supabase
  expect(
    calls.every((c) =>
      /\/(auth\/v1|rest\/v1\/(profiles|rpc\/(username_available|delete_my_account)))/.test(c),
    ),
  ).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('fangpunkt.auth'))).toBeNull();
  // erwartet: die Antwort 403 auf den absichtlich falschen Code
  expect(errors.filter((e) => !e.includes('status of 403'))).toEqual([]);
});

test('ACC-4: Übergangslösung – Anmelde-Link aus der Standard-Mail meldet an, abgelaufener Link wird erklärt', async ({
  page,
}) => {
  const calls = await fakeSupabase(page);
  await page.goto(
    `/#access_token=${TOKEN}&expires_at=${EXP}&expires_in=3600&refresh_token=r-1&token_type=bearer&type=magiclink`,
  );
  await waitForApp(page);
  await expect(page).toHaveURL(/\/mehr\/konto#?$/);
  await expect(page.getByRole('heading', { name: 'Profil anlegen' })).toBeVisible();
  expect(calls).toContain('GET /auth/v1/user');
  expect(await page.evaluate(() => location.hash)).toBe('');

  await page.evaluate(() => localStorage.removeItem('fangpunkt.auth'));
  await page.goto(
    '/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
  );
  await waitForApp(page);
  await expect(page).toHaveURL(/\/mehr\/konto$/);
  await expect(page.getByText(/Der Anmelde-Link ist abgelaufen/)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'E-Mail-Adresse' })).toBeVisible();
});
