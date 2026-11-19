// Merkt, welche Änderungen der eigenen Session von einer angenommenen Meldung stammen, damit sie nicht gleich wieder an
// die anderen gemeldet werden (sonst ginge die Pause im Kreis). Nur im Speicher; jede Marke gilt einmal.
const marks = new Set<string>();
const key = (sessionId: string, state: string) => `${sessionId}:${state}`;

export const markEcho = (sessionId: string, state: 'running' | 'paused' | 'ended') =>
  marks.add(key(sessionId, state));
export const unmarkEcho = (sessionId: string, state: 'running' | 'paused' | 'ended') =>
  marks.delete(key(sessionId, state));
/** `true`, wenn die Änderung von einer Meldung stammte (die Marke wird dabei verbraucht) */
export const consumeEcho = (sessionId: string, state: 'running' | 'paused' | 'ended') =>
  marks.delete(key(sessionId, state));
