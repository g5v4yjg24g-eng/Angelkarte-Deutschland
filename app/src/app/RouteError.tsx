import { isRouteErrorResponse, useRouteError } from 'react-router';
import { de } from '../i18n/de';
import { Button } from '../design/components/Button';
import { EmptyState } from '../design/components/EmptyState';
import { RefreshIcon } from '../design/icons';
import { NotFound } from './NotFound';

/** Fehlergrenze je Ansicht: Ein Fehler in einem Bereich reißt die übrige App nicht mit. */
export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFound />;
  }
  console.error(error);
  return (
    <EmptyState
      icon={<RefreshIcon size={32} />}
      title={de.error.title}
      action={<Button onClick={() => location.reload()}>{de.error.action}</Button>}
    >
      {de.error.text}
    </EmptyState>
  );
}
