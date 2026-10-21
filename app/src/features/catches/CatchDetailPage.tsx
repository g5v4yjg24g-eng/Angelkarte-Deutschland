// Ein Fangbuch-Eintrag: ansehen, bearbeiten, löschen (mit „Rückgängig" in der Liste), auf der Karte zeigen.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { EmptyState } from '../../design/components/EmptyState';
import { Notice } from '../../design/components/Notice';
import { BookIcon } from '../../design/icons';
import { getDb } from '../../data/db';
import { repo } from '../../data/repository';
import { CatchFacts, CatchHead } from './CatchFacts';
import { CatchForm } from './CatchForm';
import type { CatchesListState } from './CatchesPage';
import styles from './CatchesPage.module.css';

const t = de.catches;

export function CatchDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  // undefined = lädt noch, null = nicht vorhanden
  const item = useLiveQuery(async () => (await getDb().catches.get(id)) ?? null, [id]);
  const [editing, setEditing] = useState(false);

  if (item === undefined)
    return (
      <Page title={t.title} back="/fangbuch">
        <Notice>{t.loading}</Notice>
      </Page>
    );
  if (item === null || item.deletedAt)
    return (
      <Page title={t.notFoundTitle} back="/fangbuch">
        <EmptyState
          icon={<BookIcon size={32} />}
          title={t.notFoundTitle}
          action={
            <Link to="/fangbuch" className={styles.linkButton}>
              {t.backToList}
            </Link>
          }
        >
          {t.notFoundText}
        </EmptyState>
      </Page>
    );

  if (editing)
    return (
      <Page title={de.catchForm.editTitle} back="/fangbuch">
        <CatchForm initial={item} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} />
      </Page>
    );

  return (
    <Page title={de.map.outcomes[item.outcome]} back="/fangbuch">
      <div className={styles.detail}>
        <CatchHead item={item} />
        <CatchFacts item={item} />
      </div>
      <div className={styles.actions}>
        <Button onClick={() => setEditing(true)}>{de.map.edit}</Button>
        {item.position && (
          <Button variant="secondary" onClick={() => void navigate('/', { state: { assignWater: item.id } })}>
            {item.waterId ? de.catchForm.changeWater : de.catchForm.assignWater}
          </Button>
        )}
        {item.position && (
          <Button variant="secondary" onClick={() => void navigate('/', { state: { focusCatch: item.id } })}>
            {t.showOnMap}
          </Button>
        )}
        <Button
          variant="danger"
          onClick={() =>
            void repo('catches')
              .remove(item.id)
              .then(() => navigate('/fangbuch', { state: { deletedId: item.id } satisfies CatchesListState }))
          }
        >
          {de.map.delete}
        </Button>
      </div>
    </Page>
  );
}
