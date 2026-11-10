// Früherer Ort des Moderationsbereichs (/mehr/moderation/…, auch in Meldungs-Mails) → Admin-Bereich
import { Navigate, useParams } from 'react-router';
import { ADMIN_BASE } from './adminPaths';

export function LegacyModRedirect({ to }: { to: 'meldungen' | 'nutzer' }) {
  const { id, uid } = useParams();
  return <Navigate to={`${ADMIN_BASE}/${to}/${(to === 'nutzer' ? uid : id) ?? ''}`} replace />;
}
