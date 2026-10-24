/// <reference types="vite/client" />
declare const __APP_VERSION__: string;
interface ImportMetaEnv {
  readonly VITE_WATER_BASE_URL?: string;
  /** GoatCounter-Code für die anonyme Nutzungszählung; ohne Code wird nichts gezählt */
  readonly VITE_GOATCOUNTER_CODE?: string;
}
