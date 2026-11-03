import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from './fixtures';
import type { Locator } from '@playwright/test';
import { collectErrors, screenPoint, serveWaterFixture, tapRendered, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });

const SUPABASE = 'https://sgnyymciwnwjgvojptwu.supabase.co';
/** 1×1-PNG für Fotos aus dem Speicher */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const EXP = Math.floor(Date.now() / 1000) + 3600;
const TOKEN = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u-1', exp: EXP, role: 'authenticated', aud: 'authenticated', email: 'max@example.de' })}.sig`;

/** Nachgebildeter Supabase-Server: Auth (Code) und REST (profiles, Funktionen) – der echte wird nie gerufen. */
type FakeFriend = {
  request_id: string;
  user_id: string;
  username: string;
  display_name: string;
  status: 'pending' | 'accepted';
  direction: 'incoming' | 'outgoing';
  badges: string[];
  since: string;
};

async function fakeSupabase(
  page: Page,
  badges: string[] = [],
  friends: FakeFriend[] = [],
  feed: unknown[] = [],
  spots: Record<string, unknown>[] = [],
) {
  const calls: string[] = [];
  const storage = new Map<string, number>();
  const posts = new Map<
    string,
    { id: string; caption: string | null; visibility: string; photo_paths: string[] }
  >();
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
    // Feed (Etappe 3): zeitlich begrenzte Foto-Adressen und die Fotos selbst
    if (url.pathname.startsWith('/storage/v1/object/sign/')) {
      if (req.method() === 'POST') {
        const { paths } = req.postDataJSON() as { paths: string[] };
        return json(
          route,
          paths.map((path) => ({ path, signedURL: `/object/sign/post-photos/${path}?token=t`, error: null })),
        );
      }
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    }
    // Fotospeicher (Etappe 2): hochladen, auflisten, löschen
    if (url.pathname.startsWith('/storage/v1/object/')) {
      const rest = url.pathname.slice('/storage/v1/object/'.length);
      if (req.method() === 'POST' && rest.startsWith('list/')) {
        const { prefix } = req.postDataJSON() as { prefix: string };
        const names = [...storage.keys()]
          .filter((k) => k.startsWith(`${prefix}/`))
          .map((k) => k.slice(prefix.length + 1).split('/')[0] as string);
        return json(
          route,
          [...new Set(names)].map((name) => ({ name })),
        );
      }
      if (req.method() === 'POST' || req.method() === 'PUT') {
        storage.set(rest.replace(/^post-photos\//, ''), (req.postDataBuffer() ?? Buffer.alloc(0)).length);
        return json(route, { Key: rest });
      }
      if (req.method() === 'DELETE') {
        const { prefixes } = req.postDataJSON() as { prefixes: string[] };
        prefixes.forEach((k) => storage.delete(k));
        return json(route, []);
      }
    }
    if (url.pathname === '/rest/v1/posts') {
      const id = url.searchParams.get('id')?.replace('eq.', '');
      if (req.method() === 'POST') {
        const b = req.postDataJSON() as {
          id: string;
          caption: string | null;
          visibility: string;
          photo_paths: string[];
        };
        posts.set(b.id, b);
        return route.fulfill({ status: 201 });
      }
      if (req.method() === 'PATCH' && id) {
        const b = req.postDataJSON() as { caption: string | null; visibility: string };
        const cur = posts.get(id);
        if (cur) posts.set(id, { ...cur, ...b });
        return route.fulfill({ status: 204 });
      }
      if (req.method() === 'DELETE' && id) {
        posts.delete(id);
        return route.fulfill({ status: 204 });
      }
    }
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
      case 'GET /rest/v1/user_badges':
        return json(
          route,
          badges.map((badge) => ({ badge })),
        );
      case 'POST /rest/v1/rpc/feed':
        return json(route, feed);
      case 'POST /rest/v1/rpc/my_friends':
        return json(route, friends);
      case 'POST /rest/v1/rpc/send_friend_request': {
        const { name } = req.postDataJSON() as { name: string };
        if (name === 'gibtsnicht') return json(route, { code: 'P0001', message: 'not_found' }, 400);
        const back = friends.find((f) => f.username === name && f.direction === 'incoming');
        if (back) {
          back.status = 'accepted';
          return json(route, 'accepted');
        }
        friends.push({
          request_id: `r-${name}`,
          user_id: `u-${name}`,
          username: name,
          display_name: name,
          status: 'pending',
          direction: 'outgoing',
          badges: [],
          since: '2026-11-04T10:00:00Z',
        });
        return json(route, 'sent');
      }
      case 'POST /rest/v1/rpc/respond_friend_request': {
        const { request, accept } = req.postDataJSON() as { request: string; accept: boolean };
        const i = friends.findIndex((f) => f.request_id === request);
        if (accept) (friends[i] as FakeFriend).status = 'accepted';
        else friends.splice(i, 1);
        return route.fulfill({ status: 204 });
      }
      case 'POST /rest/v1/rpc/remove_friend': {
        const { other } = req.postDataJSON() as { other: string };
        friends.splice(
          friends.findIndex((f) => f.user_id === other),
          1,
        );
        return route.fulfill({ status: 204 });
      }
      // Spots teilen (Etappe 4)
      case 'POST /rest/v1/rpc/my_shared_spots':
        return json(route, spots);
      case 'POST /rest/v1/rpc/share_spot': {
        const b = req.postDataJSON() as Record<string, unknown>;
        const friend = friends.find((f) => f.user_id === b.recipient);
        if (b.recipient && friend?.status !== 'accepted')
          return json(route, { code: 'P0001', message: 'not_friends' }, 400);
        const old = spots.findIndex(
          (x) =>
            x.direction === 'outgoing' && x.place_id === b.place && (x.recipient_id ?? null) === b.recipient,
        );
        const row = {
          id: old >= 0 ? spots[old]?.id : `s-${spots.length + 1}`,
          place_id: b.place,
          direction: 'outgoing',
          owner_id: 'u-1',
          owner_username: profile?.username ?? '',
          owner_display_name: profile?.display_name ?? '',
          owner_badges: badges,
          recipient_id: b.recipient ?? null,
          recipient_username: friend?.username ?? null,
          recipient_display_name: friend?.display_name ?? null,
          place_type: b.kind,
          name: b.spot_name ?? null,
          note: b.spot_note ?? null,
          lat: b.spot_lat,
          lng: b.spot_lng,
          updated_at: new Date().toISOString(),
        };
        if (old >= 0) spots[old] = row;
        else spots.push(row);
        return json(route, row.id);
      }
      case 'POST /rest/v1/rpc/unshare_spot': {
        const { spot } = req.postDataJSON() as { spot: string };
        const i = spots.findIndex((x) => x.id === spot && x.direction === 'outgoing');
        if (i >= 0) spots.splice(i, 1);
        return route.fulfill({ status: 204 });
      }
      case 'POST /rest/v1/rpc/delete_my_account':
        profile = null;
        return route.fulfill({ status: 204 });
      default:
        return json(route, { message: `nicht nachgebildet: ${key}` }, 404);
    }
  });
  // nicht aufzählbar, damit `expect(calls).toEqual([...])` nur die Aufrufe vergleicht
  return Object.defineProperties(calls, {
    storage: { value: storage },
    posts: { value: posts },
    spots: { value: spots },
  }) as string[] & {
    storage: typeof storage;
    posts: typeof posts;
    spots: typeof spots;
  };
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
  await expect(page.getByText(/Code an max@example\.de geschickt/)).toBeVisible();
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
  // keine Fangdaten an Supabase (beim Löschen werden nur die eigenen Beitragsfotos aufgelistet)
  expect(
    calls.every((c) =>
      /\/(auth\/v1|storage\/v1\/object\/list\/post-photos|rest\/v1\/(profiles|user_badges|rpc\/(username_available|delete_my_account|my_friends)))/.test(
        c,
      ),
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

test('ACC-5: Konto freigeschaltet – Mehr → Konto zeigt das Anmeldeformular, ohne vorher Supabase zu fragen', async ({
  page,
}) => {
  const calls: string[] = [];
  await page.route('https://sgnyymciwnwjgvojptwu.supabase.co/**', (route) => {
    calls.push(route.request().url());
    return route.abort();
  });
  await page.goto('/mehr');
  await waitForApp(page);
  await expect(page.getByRole('link', { name: /^Konto.*Freiwillig/ })).toBeVisible();
  await page.getByRole('link', { name: /^Konto/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Konto' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'E-Mail-Adresse' })).toBeVisible();
  await expect(page.getByText(/Demnächst/)).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  // Ohne Eingabe keine Anfrage an Supabase
  expect(calls).toEqual([]);
});

/** Anmelden und Profil anlegen (gemeinsam für die Abzeichen-Tests) */
async function signInWithProfile(page: Page, username: string) {
  await page.goto('/mehr/konto');
  await waitForApp(page);
  await page.getByRole('textbox', { name: 'E-Mail-Adresse' }).fill('max@example.de');
  await page.getByRole('button', { name: 'Code senden' }).click();
  await page.getByRole('textbox', { name: 'Code aus der E-Mail' }).fill('123456');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.getByRole('textbox', { name: 'Nutzername' }).fill(username);
  await expect(page.getByText('Frei.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Anzeigename' }).fill('Kevin');
  await page.getByRole('button', { name: 'Profil speichern' }).click();
  await expect(page.getByText(`@${username}`)).toBeVisible();
}

async function jpeg(page: Page) {
  const bytes = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 800;
    c.height = 600;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('kein Canvas');
    ctx.fillStyle = '#2d9cdb';
    ctx.fillRect(0, 0, 800, 600);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.9));
    return Array.from(new Uint8Array(await (blob as Blob).arrayBuffer()));
  });
  return { name: 'fang.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(bytes) };
}

const founderBadge = (page: Page | Locator) => page.getByRole('img', { name: /Abzeichen: Founder/ });

test('BADGE-3: FOUNDER vom Server – im Konto, auf dem Profil (groß), am Beitrag und am Kommentar (klein)', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await fakeSupabase(page, ['founder']);
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');
  await expect(founderBadge(page)).toBeVisible();
  await expect(page.getByText('FOUNDER')).toBeVisible();

  await page.goto('/profil');
  await waitForApp(page);
  await expect(founderBadge(page)).toBeVisible();
  await expect(page.getByText('FOUNDER')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goto('/profil/neu');
  await waitForApp(page);
  await page.getByLabel('Fotos wählen').setInputFiles(await jpeg(page));
  await expect(page.getByRole('img', { name: 'Foto 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Posten' }).click();
  await page.getByRole('list', { name: 'Beiträge' }).getByRole('link').first().click();
  await expect(founderBadge(page).first()).toBeVisible();

  await page.getByRole('button', { name: 'Kommentieren' }).click();
  const sheet = page.getByRole('dialog', { name: 'Kommentare' });
  await sheet.getByLabel('Kommentar hinzufügen').fill('Petri Heil!');
  await sheet.getByLabel('Kommentar hinzufügen').press('Enter');
  await expect(sheet.getByText('Petri Heil!')).toBeVisible();
  await expect(founderBadge(sheet)).toBeVisible();
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    ).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test('BADGE-4: normales Konto ohne Abzeichen – auch ein manipulierter Speicher ändert das nicht', async ({
  page,
}) => {
  await fakeSupabase(page, []);
  await signInWithProfile(page, 'max');
  await expect(founderBadge(page)).toHaveCount(0);

  // Abzeichen im Gerätespeicher selbst eintragen: der Server sagt beim nächsten Start „keins“
  await page.evaluate(() =>
    localStorage.setItem(
      'fangpunkt.badges',
      JSON.stringify({ userId: 'u-1', badges: ['founder'], checkedAt: 1 }),
    ),
  );
  await page.goto('/profil');
  await waitForApp(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Profil' })).toBeVisible();
  await expect(founderBadge(page)).toHaveCount(0);
  expect(
    JSON.parse((await page.evaluate(() => localStorage.getItem('fangpunkt.badges'))) ?? '{}'),
  ).toMatchObject({
    userId: 'u-1',
    badges: [],
  });

  // abmelden: gemerkte Abzeichen werden vergessen
  await page.goto('/mehr/konto');
  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page.getByText('Du bist abgemeldet.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('fangpunkt.badges'))).toBeNull();
});

test('FRD-2: Freunde – Anfrage annehmen, senden, zurückziehen, entfernen; Zahl im Profil', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await fakeSupabase(
    page,
    [],
    [
      {
        request_id: 'r-anna',
        user_id: 'u-anna',
        username: 'anna',
        display_name: 'Anna',
        status: 'pending',
        direction: 'incoming',
        badges: ['founder'],
        since: '2026-11-04T09:00:00Z',
      },
    ],
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');
  await page.goto('/profil');
  await waitForApp(page);
  await page.getByRole('button', { name: 'Freunde hinzufügen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Freunde' })).toBeVisible();
  await expect(page.getByText('Dein Nutzername: @kevin')).toBeVisible();

  const incoming = page.getByRole('region', { name: 'Anfragen an dich' });
  await expect(incoming.getByText('Anna', { exact: true })).toBeVisible();
  await expect(incoming.getByRole('img', { name: /Abzeichen: Founder/ })).toBeVisible();
  await incoming.getByRole('button', { name: 'Annehmen' }).click();
  await expect(page.getByText('Du und @anna seid jetzt befreundet.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Deine Freunde (1)' }).getByText('@anna')).toBeVisible();

  await page.getByRole('textbox', { name: 'Nutzername' }).fill('gibtsnicht');
  await page.getByRole('button', { name: 'Anfrage senden' }).click();
  await expect(page.getByText('Diesen Nutzernamen gibt es nicht.', { exact: false })).toBeVisible();
  await page.getByRole('textbox', { name: 'Nutzername' }).fill('@Zander');
  await page.getByRole('button', { name: 'Anfrage senden' }).click();
  await expect(page.getByText('Anfrage an @zander gesendet.')).toBeVisible();
  const outgoing = page.getByRole('region', { name: 'Gesendete Anfragen' });
  await expect(outgoing.getByText('@zander')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    ).toEqual([]);
  }
  await outgoing.getByRole('button', { name: 'Zurückziehen' }).click();
  await expect(page.getByRole('region', { name: 'Gesendete Anfragen' })).toHaveCount(0);

  await page.goto('/profil');
  await expect(page.getByText('1', { exact: true }).locator('xpath=..')).toContainText('Freunde');
  await page.goto('/profil/freunde');
  const friendsList = page.getByRole('region', { name: 'Deine Freunde (1)' });
  await friendsList.getByRole('button', { name: 'Entfernen' }).click();
  await friendsList.getByRole('button', { name: 'Ja, entfernen' }).click();
  await expect(page.getByRole('region', { name: 'Deine Freunde (0)' })).toBeVisible();
  // erwartet: die Antwort 400 auf den unbekannten Nutzernamen
  expect(errors.filter((e) => !e.includes('status of 400'))).toEqual([]);
});

test('FRD-3: Freunde ohne Anmeldung – Hinweis aufs Konto, keine Anfrage an Supabase', async ({ page }) => {
  const calls = await fakeSupabase(page);
  await page.goto('/profil/freunde');
  await waitForApp(page);
  await expect(page.getByText(/Für Freunde brauchst du ein Konto/)).toBeVisible();
  await page.getByRole('link', { name: 'Zum Konto' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Konto' })).toBeVisible();
  expect(calls).toEqual([]);
});

test('PST-3: Beitrag teilen – angemeldet wird er mit Fotos hochgeladen, Änderungen folgen, „Nicht mehr teilen“ entfernt ihn', async ({
  page,
}) => {
  const server = await fakeSupabase(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');

  await page.goto('/profil/neu');
  await waitForApp(page);
  await expect(page.getByText(/Wird mit deinem Konto geteilt/)).toBeVisible();
  await page.getByLabel('Fotos wählen').setInputFiles(await jpeg(page));
  await page.getByLabel('Text').fill('Hecht vom Steg');
  await page.getByRole('button', { name: 'Posten' }).click();
  await page.getByRole('list', { name: 'Beiträge' }).getByRole('link').first().click();
  await expect(page.getByRole('status').filter({ hasText: 'Geteilt' })).toBeVisible();
  expect([...server.posts.values()]).toEqual([
    expect.objectContaining({ caption: 'Hecht vom Steg', visibility: 'friends' }),
  ]);
  expect([...server.storage.keys()]).toEqual([expect.stringMatching(/^u-1\/[0-9a-f-]+\/1\.jpg$/)]);

  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  await page.getByLabel('Text').fill('Hecht vom Steg, 92 cm');
  await page.getByRole('radio', { name: 'Alle' }).check({ force: true });
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect.poll(() => [...server.posts.values()][0]?.caption).toBe('Hecht vom Steg, 92 cm');
  expect([...server.posts.values()][0]?.visibility).toBe('public');

  await page.getByRole('button', { name: 'Nicht mehr teilen' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Nur auf diesem Gerät' })).toBeVisible();
  await expect.poll(() => server.posts.size).toBe(0);
  expect(server.storage.size).toBe(0);
  await page.getByRole('button', { name: 'Teilen' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Geteilt' })).toBeVisible();
  await expect.poll(() => server.posts.size).toBe(1);
});

test('PST-4: ohne Anmeldung bleibt ein neuer Beitrag auf dem Gerät', async ({ page }) => {
  const server = await fakeSupabase(page);
  await page.goto('/profil/neu');
  await waitForApp(page);
  await expect(page.getByText(/Ohne Konto bleibt der Beitrag nur auf diesem Gerät/)).toBeVisible();
  await page.getByLabel('Fotos wählen').setInputFiles(await jpeg(page));
  await page.getByRole('button', { name: 'Posten' }).click();
  await page.getByRole('list', { name: 'Beiträge' }).getByRole('link').first().click();
  await expect(page.getByRole('status').filter({ hasText: 'Nur auf diesem Gerät' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Teilen' })).toHaveCount(0);
  expect(server).toEqual([]);
});

const feedRow = (o: Record<string, unknown>) => ({
  id: '11111111-1111-4111-8111-111111111111',
  author_id: 'u-anna',
  username: 'anna',
  display_name: 'Anna',
  badges: [],
  caption: 'Zander am Abend',
  visibility: 'friends',
  photo_paths: ['u-anna/p1/1.jpg', 'u-anna/p1/2.jpg'],
  created_at: '2026-11-06T18:00:00+00:00',
  ...o,
});

test('FEED-2: Feed in der Leiste – Beiträge von Freunden mit Fotos, Name, Abzeichen und Text', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await fakeSupabase(
    page,
    [],
    [],
    [
      feedRow({}),
      feedRow({
        id: '22222222-2222-4222-8222-222222222222',
        author_id: 'u-1',
        username: 'kevin',
        display_name: 'Kevin',
        badges: ['founder'],
        caption: null,
        photo_paths: ['u-1/p2/1.jpg'],
        created_at: '2026-11-05T08:00:00+00:00',
      }),
    ],
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
  await expect(nav.getByRole('link')).toHaveText(['Karte', 'Fangbuch', 'Feed', 'Profil', 'Wetter', 'Mehr']);
  await nav.getByRole('link', { name: 'Feed' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Feed' })).toBeVisible();

  const anna = page.getByRole('article', { name: /^Beitrag von Anna/ });
  await expect(anna.getByText('Zander am Abend')).toBeVisible();
  await expect(anna.getByRole('list', { name: 'Fotos von Anna' }).getByRole('listitem')).toHaveCount(2);
  await expect(anna.locator('img').first()).toHaveJSProperty('naturalWidth', 1);
  const own = page.getByRole('article', { name: /^Beitrag von Kevin/ });
  await expect(own.getByRole('img', { name: /Abzeichen: Founder/ })).toBeVisible();
  await expect(page.getByText('Das waren alle Beiträge.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    ).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test('FEED-3: leerer Feed führt zu „Freunde hinzufügen“; ohne Anmeldung Hinweis und keine Anfrage', async ({
  page,
}) => {
  const calls = await fakeSupabase(page);
  await page.goto('/feed');
  await waitForApp(page);
  await expect(page.getByText(/Dafür brauchst du ein Konto/)).toBeVisible();
  expect(calls).toEqual([]);

  await signInWithProfile(page, 'kevin');
  await page.goto('/feed');
  await expect(page.getByText('Noch keine Beiträge')).toBeVisible();
  await page.getByRole('link', { name: 'Freunde hinzufügen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Freunde' })).toBeVisible();
});

const ANNA: FakeFriend = {
  request_id: 'r-anna',
  user_id: 'u-anna',
  username: 'anna',
  display_name: 'Anna',
  status: 'accepted',
  direction: 'incoming',
  badges: ['founder'],
  since: '2026-11-04T09:00:00Z',
};
const BUHNE = {
  id: 's-anna-1',
  place_id: 'anna-place-1',
  direction: 'incoming',
  owner_id: 'u-anna',
  owner_username: 'anna',
  owner_display_name: 'Anna',
  owner_badges: ['founder'],
  recipient_id: null,
  recipient_username: null,
  recipient_display_name: null,
  place_type: 'spot',
  name: 'Buhne 3',
  note: 'Zander abends',
  lat: 51.3283,
  lng: 6.2448,
  updated_at: '2026-11-07T08:00:00Z',
};

/** Karte ohne Fremdabrufe: Teststil statt OpenFreeMap, keine Gewässerdaten (Tipp ins Leere legt einen Ort an) */
async function localMap(page: Page) {
  await serveWaterFixture(page, { missing: true });
  await page.route('https://tiles.openfreemap.org/**', (r) =>
    r.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#dfe8e8' } }],
      },
    }),
  );
  await page.addInitScript(() => {
    localStorage.setItem('fangpunkt.mapView', JSON.stringify({ lng: 6.2418, lat: 51.3263, zoom: 15 }));
  });
}

test('SPOT-3: Spots teilen – Spot von Anna auf der Karte übernehmen, eigenen Ort teilen, Teilen beenden', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const calls = await fakeSupabase(page, [], [{ ...ANNA }], [], [{ ...BUHNE }]);
  await localMap(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');
  await page.goto('/');
  await waitForApp(page);
  await page.waitForFunction(() => !!window.__fangpunktMap?.getLayer('fp-places'), null, { timeout: 30_000 });

  // Spot von Anna: violetter Pin (Spitze unten → etwas oberhalb tippen)
  await tapRendered(page, 'fp-places', 6.2448, 51.3283, -14);
  const shared = page.getByRole('dialog', { name: 'Geteilter Spot' });
  await expect(shared.getByText('Buhne 3')).toBeVisible();
  await expect(shared.getByText(/von Anna/)).toBeVisible();
  await expect(shared.getByRole('img', { name: /Abzeichen: Founder/ })).toBeVisible();
  await expect(shared.getByText('Zander abends')).toBeVisible();
  await shared.getByRole('button', { name: 'In meine Orte übernehmen' }).click();
  await expect(page.getByText('Zu deinen Orten hinzugefügt.')).toBeVisible();
  const adopted = page.getByRole('dialog', { name: 'Angelstelle' });
  await expect(adopted.getByText('Geteilt von Anna (@anna)', { exact: false })).toBeVisible();
  await page.keyboard.press('Escape');

  // eigenen Ort anlegen und teilen
  const p = await screenPoint(page, 6.2418, 51.3253);
  await page.mouse.click(p.x, p.y);
  await page
    .getByRole('dialog', { name: 'Neu an dieser Stelle' })
    .getByRole('button', { name: 'Angelsteg' })
    .click();
  const form = page.getByRole('dialog', { name: 'Angelsteg anlegen' });
  await form.getByLabel('Bezeichnung (optional)').fill('Steg am Schilf');
  await form.getByRole('button', { name: 'Speichern' }).click();
  await tapRendered(page, 'fp-places', 6.2418, 51.3253);
  await page.getByRole('dialog', { name: 'Angelsteg' }).getByRole('button', { name: 'Teilen' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Spot teilen' })).toBeVisible();
  await expect(page.getByText('Steg am Schilf')).toBeVisible();
  await expect(page.getByRole('radio', { name: /Alle Freunde/ })).toBeChecked();
  await page.getByRole('button', { name: 'Teilen', exact: true }).click();
  await expect(page.getByText('Geteilt an alle Freunde.')).toBeVisible();
  await page.getByRole('radio', { name: /Anna/ }).check();
  await page.getByRole('button', { name: 'Teilen', exact: true }).click();
  await expect(page.getByText('Geteilt an Anna.')).toBeVisible();
  const current = page.getByRole('region', { name: 'Bereits geteilt' });
  await expect(current.getByText('an alle Freunde')).toBeVisible();
  await expect(current.getByText('an Anna')).toBeVisible();
  // genau die gespeicherte Position, nur Art/Name/Position
  const out = calls.spots.filter((x) => x.direction === 'outgoing');
  expect(out).toHaveLength(2);
  const local = await page.evaluate(
    () =>
      new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        const open = indexedDB.open('fangpunkt');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction('places').objectStore('places').getAll();
          req.onsuccess = () => {
            const rows = req.result as { name?: string; position: { lat: number; lng: number } }[];
            const hit = rows.find((x) => x.name === 'Steg am Schilf');
            if (hit) resolve(hit.position);
            else reject(new Error('Ort fehlt'));
          };
        };
      }),
  );
  expect(out[0]).toMatchObject({
    place_type: 'jetty',
    name: 'Steg am Schilf',
    note: null,
    lat: local.lat,
    lng: local.lng,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    ).toEqual([]);
  }
  await current
    .getByRole('listitem')
    .filter({ hasText: 'an alle Freunde' })
    .getByRole('button', { name: 'Nicht mehr teilen' })
    .click();
  await expect(page.getByText('Wird nicht mehr geteilt.')).toBeVisible();
  await expect(current.getByText('an alle Freunde')).toHaveCount(0);

  // Übersicht im Profil
  await page.goto('/profil');
  await page.getByRole('button', { name: 'Geteilte Spots' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Geteilte Spots' })).toBeVisible();
  const incoming = page.getByRole('region', { name: 'Mit dir geteilt' });
  await expect(incoming.getByText('Buhne 3')).toBeVisible();
  await expect(incoming.getByRole('button', { name: 'In deinen Orten' })).toBeDisabled();
  const mine = page.getByRole('region', { name: 'Von dir geteilt' });
  await expect(mine.getByText('Steg am Schilf')).toBeVisible();
  await expect(mine.getByText(/an Anna/)).toBeVisible();
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    ).toEqual([]);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await incoming.getByRole('button', { name: 'Auf der Karte' }).click();
  await expect(page.getByRole('dialog', { name: 'Geteilter Spot' }).getByText('Buhne 3')).toBeVisible();
  expect(errors.filter((e) => !/status of 404/.test(e))).toEqual([]);
});

test('SPOT-4: ohne Anmeldung – Hinweis aufs Konto, keine Anfrage an Supabase', async ({ page }) => {
  const calls = await fakeSupabase(page);
  await localMap(page);
  await page.goto('/profil/spots');
  await waitForApp(page);
  await expect(page.getByText(/Zum Teilen von Spots brauchst du ein Konto/)).toBeVisible();
  await page.goto('/');
  await waitForApp(page);
  await page.waitForFunction(() => !!window.__fangpunktMap?.getLayer('fp-places'), null, { timeout: 30_000 });
  await page.goto('/profil/spots/teilen/irgendwas');
  await expect(page.getByText(/Zum Teilen von Spots brauchst du ein Konto/)).toBeVisible();
  expect(calls).toEqual([]);
});
