import { Copy, Download, FileJson, Share2 } from 'lucide-react';
import type React from 'react';
import { Button } from '../../../components/ui/Button';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import {
  copyToClipboard,
  generateWeeklyReport,
  shareReport,
} from '../../../services/exportService';
import { exportFullBackup, exportWorkoutHistory } from '../../../services/settingsService';
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
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 16px',
        minHeight: '52px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
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
  const handleExportCsv = async () => {
    try {
      await exportWorkoutHistory();
    } catch (e) {
      logger.app.error('Export failed', e);
    }
  };

  const handleFullBackup = async () => {
    try {
      await exportFullBackup();
    } catch (e) {
      logger.app.error('Backup export failed', e);
    }
  };

  const handleWeeklyReport = async () => {
    try {
      const report = await generateWeeklyReport();
      setWeeklyReport(report);
    } catch (e) {
      logger.app.error('Report generation failed', e);
    }
  };

  const handleCopy = () => {
    if (!weeklyReport) return;
    copyToClipboard(weeklyReport);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  return (
    <div className="mb-7">
      <p className="section-title mb-3 px-1">ייצוא ושיתוף</p>
      <SettingsCard>
        <div className="flex flex-col">
          <ExportRow
            icon={<Download size={15} />}
            label="ייצוא היסטוריית אימונים (CSV)"
            onClick={handleExportCsv}
          />
          <Divider />
        </div>

        <div className="flex flex-col">
          <ExportRow
            icon={<FileJson size={15} />}
            label="גיבוי מלא (JSON)"
            onClick={handleFullBackup}
          />
          <Divider />
        </div>

        <div className="flex flex-col">
          <ExportRow icon={<Share2 size={15} />} label="דוח שבועי" onClick={handleWeeklyReport} />
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
                onClick={() => shareReport(weeklyReport)}
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
    </div>
  );
}
