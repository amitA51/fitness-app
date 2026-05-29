// ============================================================================
// COACH MESSAGES — list active clients, open a thread
// ============================================================================

import { useNavigate } from 'react-router-dom';
import { listClients } from '../../services/coach';
import { CoachPage, EmptyHint, ListRow, useAsyncData } from './_shared';

export default function CoachMessages() {
  const navigate = useNavigate();
  const { data: clients, loading } = useAsyncData(() => listClients('active'), []);

  return (
    <CoachPage title="הודעות" subtitle="Messages">
      {loading ? (
        <EmptyHint>טוען…</EmptyHint>
      ) : clients.length === 0 ? (
        <EmptyHint>אין מתאמנים פעילים לשיחה.</EmptyHint>
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
