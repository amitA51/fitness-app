// A session of several cardio parts: each part on its own card, with its own
// numbers, route and kilometres — so a warm-up walk never lends its splits or
// heart rate to the run.

import { ActivityIcon } from '../../../components/cardio/ActivityIcon';
import {
  type CardioEffort,
  RUN_TYPE_LABELS,
  cardioActivityConfig,
  cardioDistance,
  cardioPace,
  formatClock,
} from '../../../utils/cardio';
import { RouteMap } from '../components/RouteMap';
import { SplitList } from './SplitList';

function PartCard({ effort, index }: { effort: CardioEffort; index: number }) {
  const config = cardioActivityConfig(effort.activity);
  const dist = cardioDistance(effort.activity, effort.distanceKm);
  const pace = cardioPace(effort.activity, effort.distanceKm, effort.durationSec);
  const titleId = `cardio-part-${index}`;
  const hasRoute = !!effort.route && effort.route.points.length >= 2;

  return (
    <section className="cardio-part" aria-labelledby={titleId}>
      <h3 id={titleId} className="cardio-part-title">
        <ActivityIcon activity={effort.activity} size={18} />
        {config.label}
        {effort.runType && ` · ${RUN_TYPE_LABELS[effort.runType]}`}
      </h3>
      <p className="cardio-part-line">
        <span className="kinetic-number">{formatClock(effort.durationSec)}</span>
        {dist && (
          <>
            {' · '}
            <span className="kinetic-number">{dist.value}</span> {dist.unit}
          </>
        )}
        {pace && (
          <>
            {' · '}
            <span className="kinetic-number">{pace.value}</span> {pace.unit}
          </>
        )}
        {effort.avgHr !== null && (
          <>
            {' · '}
            דופק <span className="kinetic-number">{effort.avgHr}</span>
          </>
        )}
        {effort.sets > 1 && (
          <>
            {' · '}
            <span className="kinetic-number">{effort.sets}</span> מקטעים
          </>
        )}
      </p>
      {hasRoute && effort.route && (
        <RouteMap
          points={effort.route.points}
          label={`צורת המסלול של ה${config.label}`}
          height={160}
        />
      )}
      {effort.splits.length > 0 && <SplitList splits={effort.splits} />}
    </section>
  );
}

export function CardioParts({ efforts }: { efforts: readonly CardioEffort[] }) {
  return (
    <section aria-labelledby="cardio-parts-title">
      <h2 id="cardio-parts-title" className="cardio-section-title">
        חלקי האימון
      </h2>
      <div style={{ display: 'grid', gap: 10 }}>
        {efforts.map((e, i) => (
          <PartCard key={`${e.exerciseId}-${i}`} effort={e} index={i} />
        ))}
      </div>
    </section>
  );
}
