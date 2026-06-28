import { Copy, Download, FileJson, Share2, Upload } from 'lucide-react';
import type React from 'react';
import { useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { showToast } from '../../../components/ui/GlobalToast';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import {
  copyToClipboard,
  generateWeeklyReport,
  shareReport,
} from '../../../services/exportService';
import {
  exportFullBackup,
  exportWorkoutHistory,
  importFullBackup,
} from '../../../services/settingsService';
import { logger } from '../../../utils/logger';
import { Divider } from '../components/Divider';
import { IconBox } from '../components/IconBox';

interface Props {
  weeklyReport: string | null;
  setWeeklyReport: (r: string | null) => void;
  copiedReport: boolean;
  setCopiedReport: (v: boolean) => void;
}

/**
 * A single full-width "action row" (icon + label) inside the export card.
 * Collapses the three identical inline-styled buttons ProfileSection's export
 * card used to repeat. Logical `text-align: start` keeps the label edge-anchored
 * in both RTL and LTR.
 */
function ExportRow({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-2"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 16px',
        minHeight: '52px',
        border: 'none',
        background: 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        width: '100%',
        textAlign: 'start',
      }}
    >
      <IconBox>{icon}</IconBox>
      <span
        className="flex-1"
        style={{
          fontFamily: 'var(--font-hebrew)',
          fontSize: '15px',
          fontWeight: 500,
          color: 'var(--fs-ink)',
          textAlign: 'start',
        }}
      >
        {label}
      </span>
    </button>
  );
}

export function ExportSection({
  weeklyReport,
  setWeeklyReport,
  copiedReport,
  setCopiedReport,
}: Props) {
  // Tracks which action is mid-flight so we can disable its row and prevent
  // a double-fire (e.g. a second file download before the first resolves).
  const [busy, setBusy] = useState<'csv' | 'backup' | 'report' | null>(null);

  // Restore-from-backup: a file is staged on pick, then confirmed before it
  // merges into the local DB (it overwrites captured settings).
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingRestore, setPendingRestore] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);

  const handleRestoreClick = () => fileInputRef.current?.click();

  const handleRestorePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = ''; // let the same file be re-picked later
    if (file) setPendingRestore(file);
  };

  const handleConfirmRestore = async () => {
    const file = pendingRestore;
    setPendingRestore(null);
    if (!file) return;
    setRestoring(true);
    try {
      const text = await file.text();
      const result = await importFullBackup(text);
      showToast(`השחזור הושלם · ${result.records} רשומות`);
      // Reload so the restored records + settings hydrate everywhere.
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      logger.app.error('Restore failed', e);
      showToast(e instanceof Error ? e.message : 'השחזור נכשל', 'error');
    } finally {
      setRestoring(false);
    }
  };

  const handleExportCsv = async () => {
    if (busy) return;
    setBusy('csv');
    try {
      await exportWorkoutHistory();
      showToast('הקובץ יוצא בהצלחה');
    } catch (e) {
      logger.app.error('Export failed', e);
      showToast('הייצוא נכשל', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleFullBackup = async () => {
    if (busy) return;
    setBusy('backup');
    try {
      await exportFullBackup();
      showToast('הקובץ יוצא בהצלחה');
    } catch (e) {
      logger.app.error('Backup export failed', e);
      showToast('הייצוא נכשל', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleWeeklyReport = async () => {
    if (busy) return;
    setBusy('report');
    try {
      const report = await generateWeeklyReport();
      setWeeklyReport(report);
      showToast('הקובץ יוצא בהצלחה');
    } catch (e) {
      logger.app.error('Report generation failed', e);
      showToast('הייצוא נכשל', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleCopy = async () => {
    if (!weeklyReport) return;
    const ok = await copyToClipboard(weeklyReport);
    if (!ok) {
      showToast('ההעתקה נכשלה', 'error');
      return;
    }
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const handleShare = async () => {
    if (!weeklyReport) return;
    const ok = await shareReport(weeklyReport);
    if (!ok) {
      showToast('השיתוף נכשל', 'error');
    }
  };

  return (
    <div className="mb-7">
      <SectionLabel>ייצוא ושיתוף</SectionLabel>
      <SettingsCard>
        <div className="flex flex-col">
          <ExportRow
            icon={<Download size={15} />}
            label="ייצוא היסטוריית אימונים (CSV)"
            onClick={handleExportCsv}
            disabled={busy === 'csv'}
          />
          <Divider />
        </div>

        <div className="flex flex-col">
          <ExportRow
            icon={<FileJson size={15} />}
            label="גיבוי מלא (JSON)"
            onClick={handleFullBackup}
            disabled={busy === 'backup'}
          />
          <Divider />
        </div>

        <div className="flex flex-col">
          <ExportRow
            icon={<Upload size={15} />}
            label="שחזור מגיבוי (JSON)"
            onClick={handleRestoreClick}
            disabled={restoring}
          />
          <Divider />
        </div>

        <div className="flex flex-col">
          <ExportRow
            icon={<Share2 size={15} />}
            label="דוח שבועי"
            onClick={handleWeeklyReport}
            disabled={busy === 'report'}
          />
        </div>

        {weeklyReport && (
          <div className="px-4 py-3" style={{ borderTop: '1px solid var(--fs-surface-2)' }}>
            <pre
              className="whitespace-pre-wrap max-h-[300px] overflow-y-auto"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: 'var(--fs-ink)',
                background: 'var(--fs-surface-2)',
                padding: '12px',
                border: '1px solid var(--fs-primary)',
                borderRadius: 0,
                textAlign: 'start',
              }}
            >
              {weeklyReport}
            </pre>
            <div className="flex gap-2 mt-2">
              <Button
                variant="primary"
                size="sm"
                shape="sharp"
                icon={<Share2 size={14} aria-hidden="true" />}
                onClick={handleShare}
              >
                שתף
              </Button>
              <Button
                variant="secondary"
                size="sm"
                shape="sharp"
                icon={<Copy size={14} aria-hidden="true" />}
                onClick={handleCopy}
              >
                {copiedReport ? 'הועתק!' : 'העתק'}
              </Button>
            </div>
          </div>
        )}
      </SettingsCard>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleRestorePick}
        style={{ display: 'none' }}
      />
      <ConfirmDialog
        isOpen={pendingRestore !== null}
        onConfirm={handleConfirmRestore}
        onCancel={() => setPendingRestore(null)}
        title="שחזור מגיבוי"
        description="הנתונים מהגיבוי ימוזגו אל המכשיר וההגדרות יוחלפו. נתונים קיימים לא יימחקו, והדף ייטען מחדש בסיום."
        confirmLabel="שחזר"
        variant="warning"
      />
    </div>
  );
}
