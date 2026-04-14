import { memo } from 'react';

// ============================================================
// COMPONENT
// ============================================================

export interface SetProgressProps {
    current: number;
    total: number;
    completed: number;
    warmupIndices?: Set<number>;
}

export const SetProgress = memo<SetProgressProps>(({ current, total, completed, warmupIndices }) => {
    return (
        <div className="flex items-center gap-1.5">
            {Array.from({ length: total }).map((_, idx) => {
                const isCompleted = idx < completed;
                const isCurrent = idx === current;
                const isWarmup = warmupIndices?.has(idx) ?? false;

                // CSS classes for various states
                let widthClass = 'w-2';
                let bgClass = 'bg-white/20';

                if (isCurrent) {
                    widthClass = 'w-6';
                    bgClass = isWarmup ? 'bg-orange-400' : 'bg-[var(--cosmos-accent-primary)]';
                } else if (isCompleted) {
                    bgClass = isWarmup ? 'bg-orange-400/60' : 'bg-[#30D158]';
                } else if (isWarmup) {
                    bgClass = 'bg-orange-400/30';
                }

                return (
                    <div
                        key={idx}
                        className={`
                            h-2 rounded-full transition-all duration-300 ease-out
                            ${widthClass} ${bgClass}
                        `}
                    />
                );
            })}
        </div>
    );
});

SetProgress.displayName = 'SetProgress';
