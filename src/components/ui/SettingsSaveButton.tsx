import { Check, Save } from 'lucide-react';

/** Full-width save button */
interface SaveButtonProps {
  onClick: () => void;
  saved: boolean;
  label: string;
  savedLabel?: string;
}

export function SaveButton({ onClick, saved, label, savedLabel = 'נשמר!' }: SaveButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={saved ? 'accent-glow' : undefined}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        minHeight: '44px',
        padding: '12px',
        borderRadius: 0,
        fontFamily: 'var(--font-display)',
        fontSize: '14px',
        fontWeight: 800,
        textTransform: 'uppercase',
        border: saved ? 'none' : '1px solid var(--fs-surface-2)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        ...(saved
          ? { color: 'var(--fs-heading)', background: 'var(--fs-accent)' }
          : { color: 'var(--fs-accent)', background: 'var(--fs-primary)' }),
      }}
    >
      {saved ? (
        <>
          <Check size={17} />
          {savedLabel}
        </>
      ) : (
        <>
          <Save size={17} />
          {label}
        </>
      )}
    </button>
  );
}

export default SaveButton;
