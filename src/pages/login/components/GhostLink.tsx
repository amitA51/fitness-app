/**
 * Fresh Steel / Obsidian — ghost link button.
 */

interface GhostLinkProps {
  children: React.ReactNode;
  onClick?: () => void;
}

export function GhostLink({ children, onClick }: GhostLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-2 transition-colors hover:opacity-80"
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        color: 'var(--fs-muted)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        minHeight: '44px',
        minWidth: '44px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '8px',
      }}
    >
      {children}
    </button>
  );
}
