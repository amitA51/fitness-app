import { addBreadcrumb } from '../lib/sentryLazy';
import { type Metric, onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

type MetricHandler = (metric: Metric) => void;

const logMetric: MetricHandler = (metric) => {
  if (import.meta.env.DEV) {
    const color =
      metric.rating === 'good'
        ? '#0cce6b'
        : metric.rating === 'needs-improvement'
          ? '#ffa400'
          : '#ff4e42';

    console.log(
      `%c[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`,
      `color: ${color}; font-weight: bold;`
    );
  } else {
    // Production: send to Sentry as a breadcrumb + measurement on a transaction
    addBreadcrumb({
      category: 'web-vitals',
      message: `${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`,
      level: metric.rating === 'good' ? 'info' : 'warning',
      data: { name: metric.name, value: metric.value, rating: metric.rating },
    });
  }
};

export function initWebVitals(handler: MetricHandler = logMetric): void {
  onCLS(handler);
  onLCP(handler);
  onFCP(handler);
  onTTFB(handler);
  onINP(handler);
}
