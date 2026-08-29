// ============================================================================
// SETTINGS · BACKUP & RESTORE — the expert half of the old ExportSection.
// ============================================================================
// CSV export, full JSON backup and restore-from-backup. All three are
// once-in-a-while expert actions, so they live behind the group's `מתקדם`
// expander; `דוח שבועי`, the one row an ordinary user taps, was split out into
// `WeeklyReportSection` and stays top level.
//
// Behaviour is unchanged from the section this was split from: per-action
// `busy` state prevents a double-fire, restore is staged behind a ConfirmDialog
// that says what it overwrites, and every failure path shows a Hebrew toast.

import { Download, FileJson, Upload } from 'lucide-react';
import type React from 'react';
import { useRef, useState } from 'react';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { showToast } from '../../../components/ui/GlobalToast';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import {
  exportFullBackup,
  exportWorkoutHistory,
  importFullBackup,
} from '../../../services/settingsService';
import { logger } from '../../../utils/logger';
import { ActionRow } from '../components/ActionRow';
import { Divider } from '../components/Divider';

export function BackupSection() {
  const [busy, setBusy] = useState<'csv' | 'backup' | null>(null);

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

  return (
    <div>
      <SettingsCard>
        <div className="flex flex-col">
          <ActionRow
            icon={<Download size={15} />}
            label="ייצוא היסטוריית אימונים (CSV)"
            onClick={handleExportCsv}
            disabled={busy === 'csv'}
          />
          <Divider />
        </div>

        <div className="flex flex-col">
          <ActionRow
            icon={<FileJson size={15} />}
            label="גיבוי מלא (JSON) — נתוני המכשיר"
            onClick={handleFullBackup}
            disabled={busy === 'backup'}
          />
          <Divider />
        </div>

        <div className="flex flex-col">
          <ActionRow
            icon={<Upload size={15} />}
            label="שחזור מגיבוי (JSON)"
            onClick={handleRestoreClick}
            disabled={restoring}
          />
        </div>
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
        confirmLabel="שחזרו"
        variant="warning"
      />
    </div>
  );
}

export default BackupSection;
