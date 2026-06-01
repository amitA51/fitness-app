import { useEffect, useState } from 'react';

/**
 * Reactive boolean for the document's writing direction.
 *
 * Returns `true` when `document.dir === 'rtl'` (the SparkOS default, Hebrew),
 * `false` otherwise. SSR-safe: defaults to `true` when `document` is absent so
 * server-rendered markup matches the Hebrew-first client. Subscribes to the
 * `<html dir>` attribute via a MutationObserver, so a runtime language/direction
 * switch updates every consumer without a manual refresh.
 *
 * Prefer CSS logical properties (`inset-inline-*`, `margin-inline-*`,
 * `text-align: start`) for layout. Reach for this hook only when JS must branch
 * on direction (e.g. swipe sign, transform offsets, icon mirroring).
 *
 * @example
 * const isRTL = useIsRTL();
 * const exitX = isRTL ? -24 : 24;
 */
export function useIsRTL(): boolean {
  const [isRTL, setIsRTL] = useState<boolean>(() =>
    typeof document === 'undefined' ? true : document.dir === 'rtl'
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const read = () => setIsRTL(document.dir === 'rtl');
    read();

    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['dir'],
    });

    return () => observer.disconnect();
  }, []);

  return isRTL;
}

export default useIsRTL;
