// ============================================================================
// COACH HOME — enable coach mode, then roster of active clients
// ============================================================================

import { MessageSquare, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { useCoach } from '../../contexts/CoachContext';
import { getSeatUsage, listClients } from '../../services/coach';
import { CoachPage, EmptyHint, ListRow, Section, formatDate, useAsyncData } from './_shared';

export default function CoachHome() {
  const navigate = useNavigate();
  const { isCoach, loading: coachLoading, enable } = useCoach();
  const [enabling, setEnabling] = useState(false);

  if (coachLoading) {
    return (
      <CoachPage title="מאמן" subtitle="Coaching">
        {null}
      </CoachPage>
    );
  }

  if (!isCoach) {
    return (
      <CoachPage title="מצב מאמן" subtitle="Coaching" onBack={() => navigate('/')}>
        <Section>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              color: 'var(--fs-ink)',
              lineHeight: 1.6,
              marginBottom: 20,
            }}
          >
            הפעל מצב מאמן כדי לעקוב אחרי המתאמנים שלך, לראות את האימונים והתזונה שלהם, לשייך תוכניות
            ולשלוח המלצות והודעות.
          </p>
          <Button
            variant="primary"
            fullWidth
            isLoading={enabling}
            onClick={async () => {
              setEnabling(true);
              try {
                await enable();
              } finally {
                setEnabling(false);
              }
            }}
          >
            הפעל מצב מאמן
          </Button>
        </Section>
      </CoachPage>
    );
  }

  return <Roster />;
}

function Roster() {
  const navigate = useNavigate();
  const { data: clients, loading } = useAsyncData(() => listClients('active'), []);
  const { data: seats } = useAsyncData(() => getSeatUsage(), { used: 0, limit: 0, full: false });

  return (
    <CoachPage
      title="המתאמנים שלי"
      subtitle={`${seats.used}/${seats.limit} מושבים`}
      onBack={() => navigate('/')}
      actions={
        <button
          type="button"
          aria-label="הזמן מתאמן"
          onClick={() => navigate('/coach/invites')}
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            background: 'var(--fs-primary)',
            color: 'var(--fs-accent)',
          }}
        >
          <UserPlus size={18} aria-hidden="true" />
        </button>
      }
    >
      <Section>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <QuickLink
            icon={<UserPlus size={18} />}
            label="הזמנות"
            onClick={() => navigate('/coach/invites')}
          />
          <QuickLink
            icon={<Users size={18} />}
            label="קבוצות"
            onClick={() => navigate('/coach/groups')}
          />
          <QuickLink
            icon={<MessageSquare size={18} />}
            label="הודעות"
            onClick={() => navigate('/coach/messages')}
          />
        </div>
      </Section>

      <Section title="מתאמנים פעילים">
        {loading ? (
          <EmptyHint>טוען…</EmptyHint>
        ) : clients.length === 0 ? (
          <EmptyHint>עדיין אין מתאמנים מחוברים. הזמן מתאמן דרך כפתור ההזמנה למעלה.</EmptyHint>
        ) : (
          clients.map((c) => (
            <ListRow
              key={c.id}
              label={c.clientProfile?.displayName ?? 'מתאמן'}
              meta={`מחובר מאז ${formatDate(c.consentAt ?? c.createdAt)}`}
              onClick={() => navigate(`/coach/clients/${c.clientId}`)}
            />
          ))
        )}
      </Section>
    </CoachPage>
  );
}

function QuickLink({
  icon,
  label,
  onClick,
}: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 py-3"
      style={{
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        color: 'var(--fs-heading)',
      }}
    >
      {icon}
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
    </button>
  );
}
