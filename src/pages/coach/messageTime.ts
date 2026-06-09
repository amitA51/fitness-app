// ============================================================================
// MESSAGE TIME — shared timestamp + day-divider helpers for chat threads
// ============================================================================
// Used by MessageThread and GroupThread so per-message time labels and the
// date-change divider render identically across 1:1 and group chats.

/** HH:MM in 24h local time. Numbers render LTR; safe inside an RTL bubble. */
export const formatTime = (iso?: string | null): string => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
};

/** Human day label for the divider: היום / אתמול / dd/MM/yy. */
export const formatDayLabel = (iso?: string | null): string => {
  if (!iso) return '';
  try {
    const date = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (isSameLocalDay(date, today)) return 'היום';
    if (isSameLocalDay(date, yesterday)) return 'אתמול';
    return date.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  } catch {
    return '';
  }
};

/** True when both ISO timestamps fall on the same local calendar day. */
export const isSameLocalDay = (a: Date | string, b: Date | string): boolean => {
  const da = typeof a === 'string' ? new Date(a) : a;
  const db = typeof b === 'string' ? new Date(b) : b;
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
};
