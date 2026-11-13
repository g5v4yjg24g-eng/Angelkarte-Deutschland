// Gemeinsame Bausteine der Detail-Ansichten für Fang, Ort und geteilten Spot (Vorlage Nutzer 2026-11-12): Kopf mit
// Symbol im Kreis, Kacheln Gewässer · Position, Karte für Notizen, Karte mit Schalter.
import type { ReactNode } from 'react';
import { de } from '../../i18n/de';
import { ChevronRightIcon, PinIcon, WavesIcon } from '../../design/icons';
import { markerDataUrl, type MarkerKind } from './markerIcons';
import styles from './EntryView.module.css';

const v = de.catchView;

/** Kopf: Symbol im Kreis, Titel, Unterzeile (im Blatt in der Kopfkarte, auf der Seite darunter) */
export function EntryHead({
  icon,
  title,
  children,
}: {
  icon: MarkerKind;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.head}>
      <span className={styles.badge}>
        <img src={markerDataUrl(icon)} width={30} height={30} alt="" aria-hidden="true" />
      </span>
      <div className={styles.headText}>
        <p className={styles.title}>{title}</p>
        {children && <p className={`muted ${styles.sub}`}>{children}</p>}
      </div>
    </div>
  );
}

/** Kachel mit Symbol, Beschriftung und Wert; mit `onClick` ein Knopf (Pfeil rechts) */
function Tile({
  icon,
  label,
  value,
  mono,
  onClick,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  onClick?: (() => void) | undefined;
  /** Zusatz nur für Screenreader (Name = sichtbarer Text + Zusatz) */
  hint?: string;
}) {
  const body = (
    <>
      {icon}
      <span className={styles.tileText}>
        <span className={styles.tileLabel}>{label}</span>
        <strong className={mono ? `tabular ${styles.coords}` : undefined}>{value}</strong>
        {onClick && hint && <span className="visually-hidden">, {hint}</span>}
      </span>
      {onClick && mono && <ChevronRightIcon size={20} aria-hidden="true" />}
    </>
  );
  return onClick ? (
    <button type="button" className={styles.tile} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={styles.tile}>{body}</div>
  );
}

/** Kacheln Gewässer · Position; ohne Gewässer-Angabe (`water` undefined) nur die Position über die ganze Breite */
export function EntryTiles({
  water,
  position,
  onAssignWater,
  onShowOnMap,
}: {
  /** `null` = nicht zugeordnet, `undefined` = Kachel entfällt */
  water?: string | null | undefined;
  position?: { lat: number; lng: number } | undefined;
  onAssignWater?: (() => void) | undefined;
  onShowOnMap?: (() => void) | undefined;
}) {
  if (water === undefined && !position) return null;
  return (
    <div className={`${styles.tiles} ${water === undefined ? styles.single : ''}`}>
      {water !== undefined && (
        <Tile
          icon={<WavesIcon size={26} aria-hidden="true" />}
          label={v.water}
          value={water ?? v.waterNone}
          onClick={onAssignWater}
        />
      )}
      {position && (
        <Tile
          icon={<PinIcon size={26} aria-hidden="true" />}
          label={v.position}
          value={de.map.coords(position.lat, position.lng)}
          mono
          onClick={onShowOnMap}
          hint={v.positionOnMap}
        />
      )}
    </div>
  );
}

/** Karte für Text (Notiz) */
export function NoteCard({ children }: { children: ReactNode }) {
  return <p className={styles.note}>{children}</p>;
}

/** Karte mit Beschriftung links und einem Bedienelement rechts (z. B. Schalter) */
export function RowCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.rowCard}>
      <span>{label}</span>
      {children}
    </div>
  );
}
