// Prüft die App-Store-Connect-Zugangsdaten aus den Umgebungsvariablen, bevor Xcode signiert.
// Gibt nur Ergebnisse aus, nie Schlüssel. Aufruf im Workflow: node app/ios/ci/check-asc.mjs <pfad-zur-p8>
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const { ASC_KEY_ID: kid = '', ASC_ISSUER_ID: iss = '', APPLE_TEAM_ID: team = '' } = process.env;
const pem = readFileSync(process.argv[2], 'utf8');
const lines = pem.trim().split(/\r?\n/);
const problems = [];

if (!/^[A-Z0-9]{10}$/.test(kid.trim())) problems.push(`ASC_KEY_ID hat nicht die Form von 10 Großbuchstaben/Ziffern (Länge ${kid.length})`);
if (kid !== kid.trim()) problems.push('ASC_KEY_ID enthält Leerzeichen oder Zeilenumbrüche');
if (!/^[0-9a-f-]{36}$/i.test(iss.trim())) problems.push(`ASC_ISSUER_ID ist keine UUID (Länge ${iss.length})`);
if (iss !== iss.trim()) problems.push('ASC_ISSUER_ID enthält Leerzeichen oder Zeilenumbrüche');
if (!/^[A-Z0-9]{10}$/.test(team.trim())) problems.push(`APPLE_TEAM_ID hat nicht die Form von 10 Zeichen (Länge ${team.length})`);
if (lines[0] !== '-----BEGIN PRIVATE KEY-----') problems.push('ASC_PRIVATE_KEY beginnt nicht mit -----BEGIN PRIVATE KEY-----');
if (lines.at(-1) !== '-----END PRIVATE KEY-----') problems.push('ASC_PRIVATE_KEY endet nicht mit -----END PRIVATE KEY-----');
console.log(`Schlüsseldatei: ${lines.length} Zeilen`);

let key;
try {
  key = createPrivateKey(pem);
  console.log(`Schlüssel lesbar: ${key.asymmetricKeyType}`);
} catch (e) {
  problems.push(`ASC_PRIVATE_KEY lässt sich nicht lesen: ${e.message}`);
}

if (key) {
  const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'ES256', kid: kid.trim(), typ: 'JWT' });
  const body = b64({ iss: iss.trim(), iat: now, exp: now + 600, aud: 'appstoreconnect-v1' });
  const sig = sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  const res = await fetch('https://api.appstoreconnect.apple.com/v1/apps?filter[bundleId]=com.fangpunkt.app', {
    headers: { Authorization: `Bearer ${head}.${body}.${sig}` },
  });
  const json = await res.json().catch(() => ({}));
  console.log(`App Store Connect API: HTTP ${res.status}`);
  if (res.ok) console.log(`App mit Bundle-ID com.fangpunkt.app gefunden: ${json.data?.length ? 'ja' : 'NEIN'}`);
  else {
    for (const e of json.errors ?? []) console.log(`  ${e.status} ${e.code}: ${e.title} – ${e.detail}`);
    problems.push('App Store Connect lehnt die Zugangsdaten ab (Key-ID, Issuer-ID und .p8 passen nicht zusammen oder der Schlüssel wurde widerrufen)');
  }
}

if (problems.length) {
  for (const p of problems) console.log(`::error::${p}`);
  process.exit(1);
}
console.log('Zugangsdaten in Ordnung.');
