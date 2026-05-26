import { type Metric, onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

type MetricHandler = (metric: Metric) => void;

const logMetric: MetricHandler = (metric) => {
  const color =
    metric.rating === 'good'
      ? '#0cce6b'
      : metric.rating === 'needs-improvement'
        ? '#ffa400'
        : '#ff4e42';

  if (import.meta.env.DEV) {
    console.log(
      `%c[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`,
      `color: ${color}; font-weight: bold;`
    );
  }
};

export function initWebVitals(handler: MetricHandler = logMetric): void {
  onCLS(handler);
  onLCP(handler);
  onFCP(handler);
  onTTFB(handler);
  onINP(handler);
}
