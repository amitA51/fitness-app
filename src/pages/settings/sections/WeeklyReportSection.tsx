// ============================================================================
// SETTINGS · WEEKLY REPORT — the sharing half of the old ExportSection.
// ============================================================================
// `דוח שבועי` was the only row in the old four-row export card that an ordinary
// user taps; it sat between a CSV export and a JSON restore, which read as
// misfiled. It is now its own top-level card, and the three backup rows moved
// behind `מתקדם` in `BackupSection`.
//
// Behaviour is unchanged: generate → render inline, then שתף / העתק.

import { Copy, Share2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { showToast } from '../../../components/ui/GlobalToast';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import {
  copyToClipboard,
  generateWeeklyReport,
  shareReport,
} from '../../../services/exportService';
import { logger } from '../../../utils/logger';
import { ActionRow } from '../components/ActionRow';

interface Props {
  weeklyReport: string | null;
  setWeeklyReport: (r: string | null) => void;
  copiedReport: boolean;
  setCopiedReport: (v: boolean) => void;
}

export function WeeklyReportSection({
  weeklyReport,
  setWeeklyReport,
  copiedReport,
  setCopiedReport,
}: Props) {
  const [busy, setBusy] = useState(false);

  const handleWeeklyReport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const report = await generateWeeklyReport();
      setWeeklyReport(report);
      showToast('הדוח נוצר בהצלחה');
    } catch (e) {
      logger.app.error('Report generation failed', e);
      showToast('יצירת הדוח נכשלה', 'error');
    } finally {
      setBusy(false);
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
    <div className="mb-5">
      <SettingsCard>
        <ActionRow
          icon={<Share2 size={15} />}
          label="דוח שבועי"
          onClick={handleWeeklyReport}
          disabled={busy}
        />

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
                borderRadius: 12,
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
                שתפו
              </Button>
              <Button
                variant="secondary"
                size="sm"
                shape="sharp"
                icon={<Copy size={14} aria-hidden="true" />}
                onClick={handleCopy}
              >
                {copiedReport ? 'הועתק!' : 'העתיקו'}
              </Button>
            </div>
          </div>
        )}
      </SettingsCard>
    </div>
  );
}

export default WeeklyReportSection;
