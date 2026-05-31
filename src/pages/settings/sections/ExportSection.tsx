import { Copy, Download, FileJson, Share2 } from 'lucide-react';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import {
  copyToClipboard,
  generateWeeklyReport,
  shareReport,
} from '../../../services/exportService';
import { exportFullBackup, exportWorkoutHistory } from '../../../services/settingsService';
import { logger } from '../../../utils/logger';
import { DIVIDER_STYLE } from '../types';

interface Props {
  weeklyReport: string | null;
  setWeeklyReport: (r: string | null) => void;
  copiedReport: boolean;
  setCopiedReport: (v: boolean) => void;
}

export function ExportSection({
  weeklyReport,
  setWeeklyReport,
  copiedReport,
  setCopiedReport,
}: Props) {
  return (
    <div className="mb-7">
      <p className="section-title mb-3 px-1">ייצוא ושיתוף</p>
      <SettingsCard>
        <div className="flex flex-col">
          <button
            type="button"
            onClick={async () => {
              try {
                await exportWorkoutHistory();
              } catch (e) {
                logger.app.error('Export failed', e);
              }
            }}
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
              textAlign: 'right',
            }}
          >
            <div
              className="w-8 h-8 flex items-center justify-center shrink-0"
              style={{
                background: 'var(--fs-surface-2)',
                color: 'var(--fs-heading)',
                borderRadius: '8px',
              }}
            >
              <Download size={15} />
            </div>
            <span
              className="flex-1 text-right"
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: '15px',
                fontWeight: 500,
                color: 'var(--fs-ink)',
              }}
            >
              ייצוא היסטוריית אימונים (CSV)
            </span>
          </button>
          <div style={DIVIDER_STYLE} />
        </div>

        <div className="flex flex-col">
          <button
            type="button"
            onClick={async () => {
              try {
                await exportFullBackup();
              } catch (e) {
                logger.app.error('Backup export failed', e);
              }
            }}
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
              textAlign: 'right',
            }}
          >
            <div
              className="w-8 h-8 flex items-center justify-center shrink-0"
              style={{
                background: 'var(--fs-surface-2)',
                color: 'var(--fs-heading)',
                borderRadius: '8px',
              }}
            >
              <FileJson size={15} />
            </div>
            <span
              className="flex-1 text-right"
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: '15px',
                fontWeight: 500,
                color: 'var(--fs-ink)',
              }}
            >
              גיבוי מלא (JSON)
            </span>
          </button>
          <div style={DIVIDER_STYLE} />
        </div>

        <div className="flex flex-col">
          <button
            type="button"
            onClick={async () => {
              try {
                const report = await generateWeeklyReport();
                setWeeklyReport(report);
              } catch (e) {
                logger.app.error('Report generation failed', e);
              }
            }}
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
              textAlign: 'right',
            }}
          >
            <div
              className="w-8 h-8 flex items-center justify-center shrink-0"
              style={{
                background: 'var(--fs-surface-2)',
                color: 'var(--fs-heading)',
                borderRadius: '8px',
              }}
            >
              <Share2 size={15} />
            </div>
            <span
              className="flex-1 text-right"
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: '15px',
                fontWeight: 500,
                color: 'var(--fs-ink)',
              }}
            >
              דוח שבועי
            </span>
          </button>
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
              }}
            >
              {weeklyReport}
            </pre>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => shareReport(weeklyReport)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 0,
                  fontFamily: 'var(--font-hebrew)',
                  fontSize: '12px',
                  fontWeight: 600,
                  background: 'var(--fs-accent)',
                  color: 'var(--fs-heading)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Share2 size={12} /> שתף
              </button>
              <button
                type="button"
                onClick={() => {
                  copyToClipboard(weeklyReport);
                  setCopiedReport(true);
                  setTimeout(() => setCopiedReport(false), 2000);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 0,
                  fontFamily: 'var(--font-hebrew)',
                  fontSize: '12px',
                  fontWeight: 600,
                  background: 'var(--fs-surface-2)',
                  color: 'var(--fs-ink)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Copy size={12} /> {copiedReport ? 'הועתק!' : 'העתק'}
              </button>
            </div>
          </div>
        )}
      </SettingsCard>
    </div>
  );
}
