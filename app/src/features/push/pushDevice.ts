// Geräte-Token beim Konto an- und abmelden (Wunsch Nutzer 2026-11-04). Das zuletzt gemeldete Token merkt sich
// das Gerät, damit es beim Abmelden vom Konto wieder entfernt werden kann.
import { validPushToken } from '../../domain/push';
import type { AccountProvider } from '../../ports/account';
import { PUSH_TOKEN_KEY, type PushProvider } from '../../ports/push';

const ASKED_KEY = 'fangpunkt.pushAsked';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // ohne Speicher: beim nächsten Start erneut
  }
}

/** Letzter Fehler beim Anmelden (nur im Speicher) – die Einstellungen zeigen ihn, damit man sieht, woran es hakt */
let lastError: string | undefined;
export const lastPushRegisterError = () => lastError;

/** Erlaubnis vorhanden → beim System und beim Konto anmelden. Liefert das Token. */
export async function registerDevice(push: PushProvider, account: AccountProvider): Promise<string> {
  try {
    const token = (await push.register()).toLowerCase();
    if (!validPushToken(token)) throw new Error('Ungültiges Geräte-Token');
    await account.registerPushDevice(token);
    write(PUSH_TOKEN_KEY, token);
    lastError = undefined;
    return token;
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    throw e;
  }
}

/** Beim Start: einmal von selbst um Erlaubnis bitten, danach nur noch anmelden, wenn erlaubt. */
export async function setupPush(push: PushProvider, account: AccountProvider): Promise<void> {
  if (!push.available) return;
  let permission = await push.permission();
  if (permission === 'prompt' && !read(ASKED_KEY)) {
    write(ASKED_KEY, '1');
    permission = await push.requestPermission();
  }
  if (permission === 'granted') await registerDevice(push, account);
}

/** Vor dem Abmelden vom Konto: dieses Gerät soll keine Mitteilungen mehr für das Konto bekommen. */
export async function unregisterDevice(account: AccountProvider): Promise<void> {
  const token = read(PUSH_TOKEN_KEY);
  if (!token) return;
  try {
    await account.unregisterPushDevice(token);
  } finally {
    write(PUSH_TOKEN_KEY, null);
  }
}
