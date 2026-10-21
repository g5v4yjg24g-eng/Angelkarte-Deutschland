import { Link } from 'react-router';
import { de } from '../i18n/de';
import { EmptyState } from '../design/components/EmptyState';
import { InfoIcon } from '../design/icons';

export function NotFound() {
  return (
    <EmptyState
      icon={<InfoIcon size={32} />}
      title={de.notFound.title}
      action={<Link to="/">{de.notFound.action}</Link>}
    >
      {de.notFound.text}
    </EmptyState>
  );
}
