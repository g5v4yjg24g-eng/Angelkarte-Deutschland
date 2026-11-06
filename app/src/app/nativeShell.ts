// iPhone-App „wie eine echte App“ (Weg 1, Freigabe Nutzer 2026-11-06). Nur in der Capacitor-App aktiv – im Browser
// und in der Homescreen-Web-App ändert sich nichts.
// - `data-native` am <html>: Kein Markieren, kein Lupen-/Kontextmenü, kein Doppeltipp-Zoom (base.css).
// - Viewport ohne Zoomen der Oberfläche. Die Karte zoomt weiter selbst (MapLibre bekommt die Gesten direkt).
// - Tastatur: Die Ansicht wird kleiner statt hochgeschoben; solange sie offen ist, steht `data-keyboard` am <html>
//   (die untere Leiste verschwindet wie in nativen Apps hinter der Tastatur).
// Nachfedern der ganzen Fläche und Link-Vorschau stellt capacitor.config.ts ab.
import { Capacitor } from '@capacitor/core';

export function setupNativeShell(doc: Document = document) {
  if (!Capacitor.isNativePlatform()) return;
  const html = doc.documentElement;
  html.dataset.native = Capacitor.getPlatform();
  const viewport = doc.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  viewport?.setAttribute(
    'content',
    'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
  );
  void import('@capacitor/keyboard')
    .then(({ Keyboard }) => {
      void Keyboard.addListener('keyboardWillShow', () => {
        html.dataset.keyboard = 'open';
      });
      void Keyboard.addListener('keyboardWillHide', () => {
        delete html.dataset.keyboard;
      });
    })
    .catch(() => undefined);
}
