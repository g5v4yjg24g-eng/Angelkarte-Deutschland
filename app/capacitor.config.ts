// iPhone-App (IOS_PLAN.md): Capacitor verpackt den App-Build (`pnpm build:ios` → dist) als iOS-App.
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fangpunkt.app',
  appName: 'Fangpunkt',
  webDir: 'dist',
  ios: {
    // Ränder (Statusleiste, Home-Indikator) regelt die Web-App selbst über env(safe-area-inset-*)
    contentInset: 'never',
  },
};

export default config;
