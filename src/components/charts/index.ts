// This convenience barrel remains for route-local consumers. Do not import it from
// Dashboard or shared boot-path code: its value re-exports can co-locate animation
// module side effects, which previously restored the measured 72.25 kB GSAP vendor
// chunk to Dashboard's static closure. Use the concrete chart module there instead.

export { RingProgress } from './RingProgress';
export type { RingVariant } from './RingProgress';
export { ActivityRings } from './ActivityRings';
export type { ActivityRingData } from './ActivityRings';
export { GradientSparkline } from './GradientSparkline';
export { GlowAreaChart } from './GlowAreaChart';
export type { GlowAreaPoint, GlowAreaMarker } from './GlowAreaChart';
export { AnimatedBar } from './AnimatedBar';
