// Fresh Steel / Obsidian design system — audit log box (read-only, collapsed by default)

import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuditEntry } from '../../../services/coach/auditService';
import { listAudit } from '../../../services/coach/auditService';
import { InlineEmpty, ListRow, ListSkeleton, Section, SectionError, formatDate } from '../_shared';

// Hebrew label maps — fall back to the raw value if unknown
const ACTION_LABEL: Record<string, string> = {
  insert: 'הוספה',
  update: 'עדכון',
  delete: 'מחיקה',
  select: 'צפייה',
};

const TABLE_LABEL: Record<string, string> = {
  workout_templates: 'תוכנית אימון',
  nutrition_logs: 'יומן תזונה',
  assignments: 'שיוך',
  coach_notes: 'הערת מאמן',
  reminders: 'תזכורת',
  body_stats: 'מדדי גוף',
  check_ins: 'צ׳ק-אין',
};

function entryLabel(entry: AuditEntry): string {
  const action = ACTION_LABEL[entry.action] ?? entry.action;
  const table = TABLE_LABEL[entry.tableName] ?? entry.tableName;
  return `${action} · ${table}`;
}

function entryMeta(entry: AuditEntry): string {
  const date = formatDate(entry.createdAt);
  return entry.rowId ? `${date} · מזהה: ${entry.rowId}` : date;
}

interface AuditListProps {
  subjectUserId: string;
}

function AuditList({ subjectUserId }: AuditListProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // track whether we're still mounted to avoid setting state after unmount
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAudit(subjectUserId);
      if (mountedRef.current) setEntries(data);
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'error');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [subjectUserId]);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  if (loading) return <ListSkeleton rows={3} />;
  if (error) return <SectionError onRetry={load} />;
  if (entries.length === 0) return <InlineEmpty>אין פעולות עדיין</InlineEmpty>;

  return (
    <>
      {entries.map((entry) => (
        <ListRow
          key={entry.id}
          label={entryLabel(entry)}
          metaNode={
            <div
              dir="ltr"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fs-muted)' }}
            >
              {entryMeta(entry)}
            </div>
          }
        />
      ))}
    </>
  );
}

export function AuditBox({ clientId }: { clientId: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Section>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 10,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'right',
          minHeight: 44,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--fs-muted)',
          }}
        >
          יומן פעולות
        </span>
        <span
          aria-hidden="true"
          style={{
            color: 'var(--fs-muted)',
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: 'transform 150ms ease',
            display: 'inline-flex',
          }}
        >
          <ChevronDown size={16} aria-hidden="true" />
        </span>
      </button>

      {/* Lazy mount: AuditList is only created after first expand, then kept mounted */}
      {expanded && <AuditList subjectUserId={clientId} />}
    </Section>
  );
}
