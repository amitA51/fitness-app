import { User } from 'lucide-react';

export function ProfileAvatar({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex flex-col items-center py-6" style={{ background: 'var(--fs-primary)' }}>
      <div
        className="w-20 h-20 flex items-center justify-center mb-3"
        style={{ background: 'var(--fs-accent)', color: 'var(--fs-heading)' }}
      >
        {initials ? (
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: '32px',
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            {initials}
          </span>
        ) : (
          <User size={32} />
        )}
      </div>
      {name.trim() && (
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: '22px',
            color: 'var(--fs-ink)',
            textTransform: 'uppercase',
          }}
        >
          {name.trim()}
        </p>
      )}
      <p className="eyebrow mt-1" style={{ color: 'var(--fs-accent)' }}>
        § PERSONAL PROFILE
      </p>
    </div>
  );
}

export default ProfileAvatar;
