// ============================================================================
// CLIENT DETAIL (Client 360) — Fresh Steel / Obsidian design system
// ============================================================================
// Slim orchestrator: page shell + status header + message action + a single
// consolidated data hook + SegmentedControl tabs + a panel switch. All the data
// rendering lives in the five tab components under ./client/tabs/.

import { MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
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
        <Button
          variant="primary"
          size="icon"
          aria-label="שליחת הודעה למתאמן"
          onClick={() => navigate(`/coach/messages/${id}`)}
          className="shrink-0"
          style={{ background: 'var(--fs-primary)', color: 'var(--fs-accent)' }}
        >
          <MessageSquare size={18} aria-hidden="true" />
        </Button>
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
      </div>

      {data.error && data.link === null ? (
        <SectionError onRetry={data.reload} />
      ) : data.isLoading && data.link === null ? (
        <ListSkeleton rows={5} />
      ) : (
        <div
          role="tabpanel"
          id={`${TAB_PREFIX}-panel-${tab}`}
          aria-labelledby={`${TAB_PREFIX}-tab-${tab}`}
          // tabIndex=0 on a tabpanel is the WAI-ARIA Authoring Practices pattern
          // (the panel must be focusable so keyboard users reach its content).
          // biome-ignore lint/a11y/noNoninteractiveTabindex: WAI-ARIA tabpanel must be focusable
          tabIndex={0}
        >
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
              onNutritionSaved={data.reloadNutrition}
            />
          )}
          {tab === 'metrics' && (
            <MetricsTab
              clientId={id}
              weights={data.weights}
              measurements={data.measurements}
              prs={data.prs}
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
        </div>
      )}
    </CoachPage>
  );
}
