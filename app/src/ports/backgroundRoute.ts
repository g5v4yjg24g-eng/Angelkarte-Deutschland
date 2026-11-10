// Port für die Hintergrund-Route (Weg B, Wunsch Nutzer 2026-11-10): nur in der iPhone-App. Ein eigenes Swift-Modul
// (ios/App/App/RoutePlugin.swift) zeichnet während einer laufenden Session auch bei gesperrtem Bildschirm auf und
// puffert die Punkte auf dem Gerät; die Web-App holt sie mit `drain` ab. Im Browser gibt es diesen Anbieter nicht.
import type { Fix } from '../domain/track';

export type RouteStart = 'granted' | 'denied' | 'unavailable';

export interface BackgroundRoute {
  /** Aufzeichnung starten (fragt bei Bedarf „Beim Verwenden der App“); mehrfacher Aufruf schadet nicht */
  start(): Promise<RouteStart>;
  /** Aufzeichnung anhalten; gepufferte Punkte bleiben bis zum nächsten `drain` */
  stop(): Promise<void>;
  /** Gepufferte Punkte abholen (zeitlich sortiert) und den Puffer leeren */
  drain(): Promise<Fix[]>;
}
