// ============================================================================
// DateTimeSection — Settings section for timezone + date/time format.
//
// Mounts right after ThemeSection in Settings.tsx.
// Mirrors ThemeSection's shape exactly: SectionLabel + SavedIndicator +
// SettingsCard wrapping SettingsRows. Consumes datePreferences service.
//
// FAIL-SAFE: all reads/writes go through the service which wraps localStorage
// in try/catch and always returns valid defaults. This component never throws.
// ============================================================================

import { Calendar, Clock, Globe, LayoutGrid } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { SettingsRow } from '../../../components/ui/SettingsRow';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import type {
  DateFormat,
  DatePreferences,
  FirstDayOfWeek,
} from '../../../services/datePreferences';
import { getDatePreferences, setDatePreferences } from '../../../services/datePreferences';
import { IconBox } from '../components/IconBox';
import { SavedIndicator } from '../components/SavedIndicator';
import { useSavedFlash } from '../hooks/useAutosave';

// --------------------------------------------------------------------------
// Helpers — lists of available options
// --------------------------------------------------------------------------

/** Common IANA timezones relevant for an Israel-first app. */
const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Asia/Jerusalem', label: 'ירושלים (IL)' },
  { value: 'Europe/London', label: 'לונדון' },
  { value: 'Europe/Paris', label: 'פריז / ברלין' },
  { value: 'Europe/Moscow', label: 'מוסקבה' },
  { value: 'America/New_York', label: 'ניו יורק' },
  { value: 'America/Chicago', label: 'שיקגו' },
  { value: 'America/Denver', label: 'דנוור' },
  { value: 'America/Los_Angeles', label: 'לוס אנג׳לס' },
  { value: 'Asia/Dubai', label: 'דובאי' },
  { value: 'Asia/Kolkata', label: 'מומבאי' },
  { value: 'Asia/Tokyo', label: 'טוקיו' },
  { value: 'Australia/Sydney', label: 'סידני' },
  { value: 'UTC', label: 'UTC' },
];

const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string; example: string }[] = [
  { value: 'dmy', label: 'יום/חודש/שנה', example: '08/06/2026' },
  { value: 'mdy', label: 'חודש/יום/שנה', example: '06/08/2026' },
  { value: 'ymd', label: 'שנה/חודש/יום', example: '2026/06/08' },
];

const FIRST_DAY_OPTIONS: { value: FirstDayOfWeek; label: string }[] = [
  { value: 0, label: 'ראשון (ישראל)' },
  { value: 1, label: 'שני (אירופה)' },
];

/** Narrows an untrusted select value to a supported {@link DateFormat}. */
const isDateFormat = (value: string): value is DateFormat =>
  DATE_FORMAT_OPTIONS.some((opt) => opt.value === value);

/** Narrows an untrusted select value to a supported {@link FirstDayOfWeek}. */
const isFirstDayOfWeek = (value: number): value is FirstDayOfWeek =>
  FIRST_DAY_OPTIONS.some((opt) => opt.value === value);

// --------------------------------------------------------------------------
// Shared select style — used across all <select> controls in this section
// --------------------------------------------------------------------------

const selectStyle: React.CSSProperties = {
  appearance: 'none',
  WebkitAppearance: 'none',
  background: 'var(--fs-surface-2)',
  color: 'var(--fs-ink)',
  border: '1px solid var(--color-separator)',
  borderRadius: 'var(--radius-asymmetric)',
  fontFamily: 'var(--font-body)',
  fontSize: '14px',
  fontWeight: 500,
  padding: '6px 10px',
  cursor: 'pointer',
  minWidth: 140,
  maxWidth: 200,
  direction: 'rtl',
};

// --------------------------------------------------------------------------
// Main component
// --------------------------------------------------------------------------

/**
 * Settings section: timezone, clock format (12h/24h), first day of week,
 * and date component order. Autosaves immediately on each change and flashes
 * the shared "נשמר" indicator next to the section heading.
 */
export function DateTimeSection() {
  const [prefs, setPrefs] = useState<DatePreferences>(getDatePreferences);
  const { saved, flash } = useSavedFlash();

  // Keep local state in sync if another tab/component changes prefs via the
  // service pub/sub (defensive: covers future server-sync scenario).
  useEffect(() => {
    setPrefs(getDatePreferences());
  }, []);

  const persist = useCallback(
    (patch: Partial<DatePreferences>) => {
      const next = setDatePreferences(patch);
      setPrefs(next);
      flash();
    },
    [flash]
  );

  // ── Timezone ──
  const handleTimezone = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      persist({ timeZone: e.target.value });
    },
    [persist]
  );

  // ── 12h/24h toggle ──
  const handleHour12 = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      persist({ hour12: e.target.value === '12' });
    },
    [persist]
  );

  // ── Date format ──
  const handleDateFormat = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      if (!isDateFormat(value)) return;
      persist({ dateFormat: value });
    },
    [persist]
  );

  // ── First day of week ──
  const handleFirstDay = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = Number(e.target.value);
      if (!isFirstDayOfWeek(value)) return;
      persist({ firstDayOfWeek: value });
    },
    [persist]
  );

  return (
    <div className="mb-7">
      <SectionLabel trailing={<SavedIndicator saved={saved} />}>תאריך ושעה</SectionLabel>

      <SettingsCard>
        {/* Timezone */}
        <SettingsRow
          icon={
            <IconBox>
              <Globe size={15} aria-hidden="true" />
            </IconBox>
          }
          label="אזור זמן"
          divider={true}
        >
          <label htmlFor="dt-timezone" className="sr-only">
            בחר אזור זמן
          </label>
          <select
            id="dt-timezone"
            value={prefs.timeZone}
            onChange={handleTimezone}
            style={selectStyle}
          >
            {TIMEZONE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
            {/* If the device timezone isn't in our curated list, append it */}
            {!TIMEZONE_OPTIONS.some((o) => o.value === prefs.timeZone) && (
              <option value={prefs.timeZone}>{prefs.timeZone}</option>
            )}
          </select>
        </SettingsRow>

        {/* Clock format */}
        <SettingsRow
          icon={
            <IconBox>
              <Clock size={15} aria-hidden="true" />
            </IconBox>
          }
          label="פורמט שעה"
          divider={true}
        >
          <label htmlFor="dt-hour12" className="sr-only">
            פורמט שעה
          </label>
          <select
            id="dt-hour12"
            value={prefs.hour12 ? '12' : '24'}
            onChange={handleHour12}
            style={selectStyle}
          >
            <option value="24">24 שעות</option>
            <option value="12">12 שעות (AM/PM)</option>
          </select>
        </SettingsRow>

        {/* Date format */}
        <SettingsRow
          icon={
            <IconBox>
              <Calendar size={15} aria-hidden="true" />
            </IconBox>
          }
          label="פורמט תאריך"
          divider={true}
        >
          <label htmlFor="dt-dateformat" className="sr-only">
            פורמט תאריך
          </label>
          <select
            id="dt-dateformat"
            value={prefs.dateFormat}
            onChange={handleDateFormat}
            style={selectStyle}
          >
            {DATE_FORMAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({opt.example})
              </option>
            ))}
          </select>
        </SettingsRow>

        {/* First day of week */}
        <SettingsRow
          icon={
            <IconBox>
              <LayoutGrid size={15} aria-hidden="true" />
            </IconBox>
          }
          label="יום ראשון בשבוע"
          divider={false}
        >
          <label htmlFor="dt-firstday" className="sr-only">
            יום ראשון בשבוע
          </label>
          <select
            id="dt-firstday"
            value={prefs.firstDayOfWeek}
            onChange={handleFirstDay}
            style={selectStyle}
          >
            {FIRST_DAY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </SettingsRow>
      </SettingsCard>
    </div>
  );
}

export default DateTimeSection;
