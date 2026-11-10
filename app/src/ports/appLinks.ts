// Port für Links, die die iPhone-App öffnen (Universal Links von fangpunkt.com). Im Browser gibt es ihn nicht.
export interface AppLinks {
  /** Link, mit dem die App gestartet wurde (falls vorhanden) */
  launchUrl(): Promise<string | undefined>;
  /** Links, während die App läuft; liefert die Abmeldung */
  onOpen(listener: (url: string) => void): () => void;
}
