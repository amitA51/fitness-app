export const getWeekStart = (d: Date) => {
  const t = new Date(d);
  const day = t.getDay();
  t.setDate(t.getDate() - day + (day === 0 ? -6 : 1));
  return t;
};

export const getWeekEnd = (weekStart: Date) => {
  const t = new Date(weekStart);
  t.setDate(t.getDate() + 6);
  return t;
};

export const getWeekNumber = (d: Date) => {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
};

export const fmtDate = (d: string) => {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (diff === 0) return 'היום';
  if (diff === 1) return 'אתמול';
  if (diff < 7) return `לפני ${diff} ימים`;
  return new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
};

export const isToday = (d: string) => {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  return diff === 0;
};

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : 'ערב טוב';
};

export const todayHe = () =>
  new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });

export const pad2 = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, '0');

export const DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'] as const;

export const MONO_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.22em',
};
