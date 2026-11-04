// Ein von Freunden geteilter Spot (Etappe 4): wer, was, wo – und in die eigenen Orte übernehmen.
// Gemeinsam für das Kartenblatt und die Liste „Geteilte Spots“.
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import type { SharedSpot } from '../../domain/sharedSpots';
import { formatDateTime } from '../../lib/storage';
import { FounderBadge } from '../badges/FounderBadge';
import { markerDataUrl, type MarkerKind } from '../map/markerIcons';
import { SafetyMenu } from '../moderation/SafetyMenu';
import styles from './Spots.module.css';

const t = de.spots;

export function PlaceHead({
  icon,
  title,
  children,
}: {
  icon: MarkerKind;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={styles.head}>
      <img src={markerDataUrl(icon)} width={28} height={28} alt="" aria-hidden="true" />
      <div className={styles.who}>
        <p className={styles.title}>{title}</p>
        {children && <span className="muted">{children}</span>}
      </div>
    </div>
  );
}

export function SpotHead({ spot }: { spot: SharedSpot }) {
  const incoming = spot.direction === 'incoming';
  return (
    <PlaceHead
      icon={incoming ? 'shared-spot' : `place-${spot.type}`}
      title={spot.name ?? de.map.placeTypes[spot.type]}
    >
      {spot.name && `${de.map.placeTypes[spot.type]} · `}
      {incoming ? (
        <>
          {t.from(spot.ownerName)}
          {spot.ownerBadges.includes('founder') && <FounderBadge />} {t.handle(spot.ownerUsername)}
        </>
      ) : spot.recipient ? (
        t.to(spot.recipient.name)
      ) : (
        t.toAll
      )}
    </PlaceHead>
  );
}

export function SharedSpotDetails({
  spot,
  adopted,
  onAdopt,
  onShowMap,
  onSafety,
}: {
  spot: SharedSpot;
  adopted: boolean;
  onAdopt: () => void;
  onShowMap?: (() => void) | undefined;
  /** Melden/Blockieren erledigt (Etappe 5) – Text für einen Hinweis */
  onSafety?: ((message: string) => void) | undefined;
}) {
  return (
    <>
      <div className={styles.headRow}>
        <SpotHead spot={spot} />
        {onSafety && spot.direction === 'incoming' && (
          <SafetyMenu
            kind="spot"
            targetId={spot.id}
            owner={{ id: spot.ownerId, name: spot.ownerName }}
            onDone={onSafety}
          />
        )}
      </div>
      {spot.note && <p className={styles.note}>{spot.note}</p>}
      <p className="muted tabular">{de.map.coords(spot.lat, spot.lng)}</p>
      <p className="muted">{t.sharedOn(formatDateTime(spot.updatedAt))}</p>
      <div className={styles.buttons}>
        {onShowMap && (
          <Button variant="secondary" onClick={onShowMap}>
            {t.showOnMap}
          </Button>
        )}
        <Button onClick={onAdopt} disabled={adopted}>
          {adopted ? t.adopted : t.adopt}
        </Button>
      </div>
    </>
  );
}
