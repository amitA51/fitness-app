// ============================================================================
// CLIENT DETAIL (Client 360) — Fresh Steel / Obsidian design system
// ============================================================================
// Slim orchestrator: page shell + status header + message action + a single
// consolidated data hook + SegmentedControl tabs + a panel switch. All the data
// rendering lives in the five tab components under ./client/tabs/.

import { m } from 'framer-motion';
import { FileText, MessageSquare } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EASE_OUT } from '../../components/motion/easings';
import { Button } from '../../components/ui/Button';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { SegmentedControl } from '../progress/components/SegmentedControl';
import { CoachPage, ListSkeleton, SectionError } from './_shared';
import { CommsTab } from './client/tabs/CommsTab';
import { MetricsTab } from './client/tabs/MetricsTab';
import { NutritionTab } from './client/tabs/NutritionTab';
import { OverviewTab } from './client/tabs/OverviewTab';
import { TrainingTab } from './client/tabs/TrainingTab';
import { useClientData } from './client/useClientData';

// Trainee link status → Hebrew (never surface the raw English enum to the coach).
const STATUS_LABEL: Record<string, string> = {
  pending: 'ממתין',
  active: 'פעיל',
  paused: 'מושהה',
  ended: 'הסתיים',
};

type TabKey = 'overview' | 'training' | 'nutrition' | 'metrics' | 'comms';

const TABS: readonly { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'סקירה' },
  { key: 'training', label: 'אימונים' },
  { key: 'nutrition', label: 'תזונה' },
  { key: 'metrics', label: 'מדדים' },
  { key: 'comms', label: 'תקשורת' },
];

const TAB_PREFIX = 'client360';

export default function ClientDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('overview');
  const data = useClientData(id);
  const reduced = useReducedMotion();

  const name = data.link?.clientProfile?.displayName ?? 'מתאמן';
  const subtitle = data.link
    ? `מצב: ${STATUS_LABEL[data.link.status] ?? data.link.status}`
    : 'מתאמן';
  const latestWeight = data.weights[0]?.weight;

  return (
    <CoachPage
      title={name}
      subtitle={subtitle}
      actions={
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            aria-label="דוח התקדמות למתאמן"
            onClick={() => navigate(`/coach/clients/${id}/report`)}
            className="whitespace-nowrap"
          >
            <FileText size={16} aria-hidden="true" />
            דוח התקדמות
          </Button>
          <Button
            variant="primary"
            size="icon"
            aria-label="שליחת הודעה למתאמן"
            onClick={() => navigate(`/coach/messages/${id}`)}
            style={{ background: 'var(--fs-primary)', color: 'var(--fs-accent)' }}
          >
            <MessageSquare size={18} aria-hidden="true" />
          </Button>
        </div>
      }
    >
      <div className="mb-5">
        <SegmentedControl
          options={TABS}
          value={tab}
          onChange={setTab}
          ariaLabel="ניווט בפרופיל המתאמן"
          idPrefix={TAB_PREFIX}
        />
        {/* 2px accent loading bar — surfaces a background refresh while the
            shell (link) is already on screen, so a tab switch never looks
            frozen. Hidden once data settles. */}
        <div
          aria-hidden="true"
          style={{ height: 2, marginTop: 8, background: 'var(--fs-surface-2)', overflow: 'hidden' }}
        >
          {data.isLoading && data.link !== null && <TabLoadingBar />}
        </div>
      </div>

      {data.error && data.link === null ? (
        <SectionError onRetry={data.reload} />
      ) : data.isLoading && data.link === null ? (
        <ListSkeleton rows={5} />
      ) : (
        <TabPanel tab={tab} prefix={TAB_PREFIX} reduced={reduced}>
          {tab === 'overview' && (
            <OverviewTab
              clientId={id}
              link={data.link}
              analytics={data.analytics}
              latestWeight={latestWeight}
              onPaused={() => navigate('/coach')}
            />
          )}
          {tab === 'training' && (
            <TrainingTab
              clientId={id}
              analytics={data.analytics}
              sessions={data.sessions}
              sessionsLoading={data.isLoading}
              onSessionSaved={data.reloadSessions}
            />
          )}
          {tab === 'nutrition' && (
            <NutritionTab
              clientId={id}
              nutrition={data.nutrition}
              assignments={data.assignments}
              loading={data.nutritionLoading}
              error={data.nutritionError}
              onReload={data.reloadNutrition}
              onNutritionSaved={data.reloadNutrition}
            />
          )}
          {tab === 'metrics' && (
            <MetricsTab
              clientId={id}
              weights={data.weights}
              measurements={data.measurements}
              prs={data.prs}
              measurementsLoading={data.measurementsLoading}
              measurementsError={data.measurementsError}
              onReloadMeasurements={data.reloadMeasurements}
              prsLoading={data.prsLoading}
              prsError={data.prsError}
              onReloadPrs={data.reloadPrs}
              onWeightSaved={data.reloadWeights}
            />
          )}
          {tab === 'comms' && (
            <CommsTab
              clientId={id}
              link={data.link}
              sessions={data.sessions}
              checkIns={data.checkIns}
              assignments={data.assignments}
            />
          )}
        </TabPanel>
      )}
    </CoachPage>
  );
}

// ── Tab panel ────────────────────────────────────────────────────────────────
// Focusable WAI-ARIA tabpanel with a per-switch fade-in (re-keyed on `tab`) and
// a visible focus ring. Under prefers-reduced-motion it renders instantly with
// no transform. The accent ring + offset keep the focus indicator visible on
// the page background in both light and dark.
function TabPanel({
  tab,
  prefix,
  reduced,
  children,
}: {
  tab: string;
  prefix: string;
  reduced: boolean;
  children: React.ReactNode;
}) {
  const common = {
    role: 'tabpanel' as const,
    id: `${prefix}-panel-${tab}`,
    'aria-labelledby': `${prefix}-tab-${tab}`,
    // tabIndex=0 on a tabpanel is the WAI-ARIA Authoring Practices pattern
    // (the panel must be focusable so keyboard users reach its content).
    tabIndex: 0,
    className:
      'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--fs-bg)]',
  };

  if (reduced) {
    // biome-ignore lint/a11y/noNoninteractiveTabindex: WAI-ARIA tabpanel must be focusable
    return <div {...common}>{children}</div>;
  }

  return (
    <m.div
      key={tab}
      {...common}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
    >
      {children}
    </m.div>
  );
}

// ── Tab loading bar ──────────────────────────────────────────────────────────
// A 2px accent sweep shown during a background refresh. Indeterminate slide;
// reduced-motion shows a static accent fill instead of the sweep.
function TabLoadingBar() {
  const reduced = useReducedMotion();
  if (reduced) {
    return <div style={{ height: '100%', background: 'var(--fs-accent)', opacity: 0.6 }} />;
  }
  return (
    <m.div
      style={{ height: '100%', width: '40%', background: 'var(--fs-accent)' }}
      initial={{ x: '-100%' }}
      animate={{ x: '320%' }}
      transition={{ duration: 1.1, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
    />
  );
}
