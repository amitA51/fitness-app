// ============================================================================
// COACH MESSAGES — list active clients, open a thread
// ============================================================================

import { useNavigate } from 'react-router-dom';
import EmptyState from '../../components/ui/EmptyState';
import { listClients } from '../../services/coach';
import { CoachPage, ListRow, ListSkeleton, useAsyncData } from './_shared';

export default function CoachMessages() {
  const navigate = useNavigate();
  const { data: clients, loading } = useAsyncData(() => listClients('active'), []);

  return (
    <CoachPage title="הודעות" subtitle="Messages">
      {loading ? (
        <ListSkeleton rows={4} />
      ) : clients.length === 0 ? (
        <EmptyState
          illustration="feed"
          title="אין מתאמנים פעילים לשיחה"
          description="הזמן מתאמן כדי להתחיל התכתבות."
        />
      ) : (
        clients.map((c) => (
          <ListRow
            key={c.id}
            label={c.clientProfile?.displayName ?? 'מתאמן'}
            onClick={() => navigate(`/coach/messages/${c.clientId}`)}
          />
        ))
      )}
    </CoachPage>
  );
}
