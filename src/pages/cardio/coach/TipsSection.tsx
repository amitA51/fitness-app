// "טיפים" — a few tips that fit the moment (summer → heat, new runner →
// basics), and every tip behind "כל הטיפים", grouped by topic. Each tip says
// how strong the evidence behind it is.

import { ChevronDown } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import {
  EVIDENCE_LABELS,
  RUNNING_TIPS,
  type RunningTip,
  TIP_TOPIC_LABELS,
  type TipTopic,
  tipsFor,
} from '../../../services/running';
import './coach-tips.css';

interface TipsSectionProps {
  isSummer: boolean;
  isBeginner: boolean;
}

function TipCard({ tip, as: Heading = 'h3' }: { tip: RunningTip; as?: 'h3' | 'h4' }) {
  return (
    <article className="rc-tip">
      <div className="rc-tip-head">
        <Heading className="rc-tip-title">{tip.title}</Heading>
        <span className="rc-tag">{EVIDENCE_LABELS[tip.evidence]}</span>
      </div>
      <p className="rc-body" style={{ fontSize: 14 }}>
        {tip.body}
      </p>
    </article>
  );
}

export function TipsSection({ isSummer, isBeginner }: TipsSectionProps) {
  const uid = useId();
  const [showAll, setShowAll] = useState(false);
  const picked = useMemo(() => tipsFor({ isSummer, isBeginner }, 3), [isSummer, isBeginner]);
  const groups = useMemo(() => {
    const byTopic = new Map<TipTopic, RunningTip[]>();
    for (const tip of RUNNING_TIPS)
      byTopic.set(tip.topic, [...(byTopic.get(tip.topic) ?? []), tip]);
    return [...byTopic.entries()];
  }, []);

  return (
    <section className="rc-tips" aria-labelledby={`${uid}-h`}>
      <h2 id={`${uid}-h`} className="rc-title">
        טיפים
      </h2>
      {picked.map((tip) => (
        <TipCard key={tip.id} tip={tip} />
      ))}

      <button
        type="button"
        className="cta-secondary focus-ring"
        aria-expanded={showAll}
        aria-controls={`${uid}-all`}
        onClick={() => setShowAll((v) => !v)}
      >
        {showAll ? 'פחות טיפים' : `כל הטיפים (${RUNNING_TIPS.length})`}
        <ChevronDown
          size={18}
          aria-hidden="true"
          className="rc-topic-chevron"
          style={showAll ? { transform: 'rotate(180deg)' } : undefined}
        />
      </button>

      <div
        id={`${uid}-all`}
        className="rc-card"
        style={{ paddingBlock: 4, gap: 0 }}
        hidden={!showAll}
      >
        {groups.map(([topic, tips]) => (
          <details key={topic} className="rc-topic">
            <summary className="focus-ring">
              <span>
                {TIP_TOPIC_LABELS[topic]}{' '}
                <span className="rc-muted" style={{ display: 'inline' }}>
                  (<span className="kinetic-number">{tips.length}</span>)
                </span>
              </span>
              <ChevronDown size={18} aria-hidden="true" className="rc-topic-chevron" />
            </summary>
            <div className="rc-topic-body">
              {tips.map((tip) => (
                <TipCard key={tip.id} tip={tip} as="h4" />
              ))}
            </div>
          </details>
        ))}
      </div>

      <p className="rc-muted">
        התגיות אומרות כמה המידע מבוסס: מחקר חזק, מחקר בינוני או ניסיון מאמנים.
      </p>
    </section>
  );
}
