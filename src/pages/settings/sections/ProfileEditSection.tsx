// ============================================================================
// SETTINGS · PUBLIC PROFILE EDITOR — עריכת פרופיל ציבורי
//
// Edits the public-safe profile fields (display name, bio, public visibility,
// avatar) via the existing profile service. PII (DOB, body metrics) is edited
// elsewhere — this section only touches the columns exposed on /u/:userId.
//
// FAIL-SAFE: getMyProfile returns null when Supabase is unconfigured / the
// migration is unapplied / the user is signed out; the section then shows a
// quiet local notice instead of crashing. Writes go through updateProfile /
// uploadAvatar, which return a { error } envelope rather than throwing.
//
// Matches the LegalLinksSection card idiom: role="switch" toggle, RTL,
// label-above-input, inline errors, and a SavedIndicator flash on success.
// ============================================================================

import { Camera, Globe, Loader2, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import {
  getMyProfile,
  updateProfile,
  uploadAvatar,
} from '../../../services/profile/profileService';
import { SavedIndicator } from '../components/SavedIndicator';

const MAX_BIO = 280;
const SAVED_FLASH_MS = 1800;

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--fs-surface)',
  borderRadius: 'var(--radius-asymmetric)',
  overflow: 'hidden',
  padding: 20,
};

const FIELD_LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--fs-ink)',
  marginBottom: 6,
};

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '10px 12px',
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  color: 'var(--fs-ink)',
  background: 'var(--fs-bg)',
  border: '1px solid var(--fs-surface-2)',
  borderRadius: 10,
  outline: 'none',
  textAlign: 'start',
};

const HELPER_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 12,
  color: 'var(--fs-muted)',
  marginTop: 4,
};

const ERROR_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 12,
  color: 'var(--fs-error, #d23f3f)',
  marginTop: 4,
};

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

const getInitials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

type LoadState = 'loading' | 'unavailable' | 'ready';

export function ProfileEditSection() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const p = await getMyProfile();
      if (!active) return;
      if (!p) {
        setLoadState('unavailable');
        return;
      }
      setDisplayName(p.displayName ?? '');
      setBio(p.bio ?? '');
      setIsPublic(p.isPublic);
      setAvatarUrl(p.avatarUrl);
      setLoadState('ready');
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    []
  );

  const flashSaved = () => {
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), SAVED_FLASH_MS);
  };

  const validate = (): string | null => {
    if (!displayName.trim()) return 'יש להזין שם תצוגה.';
    if (bio.length > MAX_BIO) return `התיאור ארוך מדי (עד ${MAX_BIO} תווים).`;
    return null;
  };

  const handleSave = async () => {
    setFormError(null);
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);
    const { error } = await updateProfile({
      displayName: displayName.trim(),
      bio: bio.trim() || null,
      isPublic,
    });
    setSaving(false);
    if (error) {
      setFormError('השמירה נכשלה. בדקו את החיבור ונסו שוב.');
      return;
    }
    flashSaved();
  };

  const handleToggle = async () => {
    const next = !isPublic;
    setIsPublic(next);
    const { error } = await updateProfile({ isPublic: next });
    if (error) {
      setIsPublic(!next); // revert on failure
      setFormError('עדכון נראות הפרופיל נכשל.');
      return;
    }
    flashSaved();
  };

  const handleAvatarPick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    setAvatarError(null);
    setUploading(true);
    const { url, error } = await uploadAvatar(file);
    setUploading(false);
    if (error || !url) {
      setAvatarError('העלאת התמונה נכשלה. נסו תמונה אחרת.');
      return;
    }
    setAvatarUrl(url);
    flashSaved();
  };

  if (loadState === 'loading') {
    return (
      <div className="mb-7">
        <SectionLabel>פרופיל ציבורי</SectionLabel>
        <div style={CARD_STYLE} aria-busy="true">
          <div
            className="animate-pulse"
            style={{ height: 44, borderRadius: 10, background: 'var(--fs-surface-2)' }}
          />
          <div
            className="animate-pulse"
            style={{
              height: 88,
              borderRadius: 10,
              background: 'var(--fs-surface-2)',
              marginTop: 16,
            }}
          />
        </div>
      </div>
    );
  }

  if (loadState === 'unavailable') {
    return (
      <div className="mb-7">
        <SectionLabel>פרופיל ציבורי</SectionLabel>
        <div style={CARD_STYLE}>
          <p style={{ ...HELPER_STYLE, marginTop: 0, fontSize: 14 }}>
            עריכת הפרופיל הציבורי תהיה זמינה לאחר התחברות לחשבון מסונכרן.
          </p>
        </div>
      </div>
    );
  }

  const initials = getInitials(displayName);

  return (
    <div className="mb-7">
      <SectionLabel trailing={<SavedIndicator saved={saved} />}>פרופיל ציבורי</SectionLabel>

      <div style={CARD_STYLE}>
        {/* ── Avatar uploader ─────────────────────────────────────────────── */}
        <div style={{ ...ROW_STYLE, marginBottom: 20 }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="תצוגה מקדימה של תמונת הפרופיל"
              width={64}
              height={64}
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                objectFit: 'cover',
                background: 'var(--fs-surface-2)',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex items-center justify-center"
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'var(--fs-accent)',
                color: 'var(--color-ink-on-accent)',
                flexShrink: 0,
              }}
            >
              {initials ? (
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 900,
                    fontSize: 24,
                    lineHeight: 1,
                  }}
                >
                  {initials}
                </span>
              ) : (
                <UserRound size={28} />
              )}
            </div>
          )}

          <div style={{ flex: 1 }}>
            <button
              type="button"
              onClick={handleAvatarPick}
              disabled={uploading}
              className="active:scale-[0.98] inline-flex items-center gap-2"
              style={{
                padding: '8px 14px',
                borderRadius: 999,
                border: '1px solid var(--fs-surface-2)',
                cursor: uploading ? 'default' : 'pointer',
                background: 'var(--fs-bg)',
                color: 'var(--fs-ink)',
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                fontWeight: 600,
                opacity: uploading ? 0.6 : 1,
              }}
            >
              {uploading ? (
                <Loader2 size={15} aria-hidden="true" className="animate-spin" />
              ) : (
                <Camera size={15} aria-hidden="true" />
              )}
              {uploading ? 'מעלה…' : 'החלפת תמונה'}
            </button>
            <p style={HELPER_STYLE}>JPG או PNG, עד כמה מגה-בייט.</p>
            {avatarError && (
              <p role="alert" style={ERROR_STYLE}>
                {avatarError}
              </p>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            aria-label="העלאת תמונת פרופיל"
            style={{ display: 'none' }}
          />
        </div>

        {/* ── Display name ────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="profile-display-name" style={FIELD_LABEL_STYLE}>
            שם תצוגה
          </label>
          <input
            id="profile-display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="איך שיקראו לך"
            maxLength={60}
            aria-invalid={formError != null && !displayName.trim()}
            style={INPUT_STYLE}
          />
        </div>

        {/* ── Bio ──────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="profile-bio" style={FIELD_LABEL_STYLE}>
            תיאור קצר
          </label>
          <textarea
            id="profile-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="ספרו משהו על עצמכם"
            rows={3}
            maxLength={MAX_BIO}
            style={{ ...INPUT_STYLE, minHeight: 80, resize: 'vertical', lineHeight: 1.5 }}
          />
          <p style={HELPER_STYLE}>
            <span dir="ltr" className="kinetic-number">
              {bio.length}/{MAX_BIO}
            </span>
          </p>
        </div>

        {formError && (
          <p role="alert" style={{ ...ERROR_STYLE, marginBottom: 12 }}>
            {formError}
          </p>
        )}

        {/* ── Save ─────────────────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="active:scale-[0.98] inline-flex items-center justify-center gap-2"
          style={{
            width: '100%',
            minHeight: 44,
            borderRadius: 12,
            border: 'none',
            cursor: saving ? 'default' : 'pointer',
            background: 'var(--fs-accent)',
            color: 'var(--color-ink-on-accent)',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 700,
            opacity: saving ? 0.7 : 1,
            marginBottom: 20,
          }}
        >
          {saving && <Loader2 size={16} aria-hidden="true" className="animate-spin" />}
          {saving ? 'שומר…' : 'שמירת פרופיל'}
        </button>

        {/* ── Public visibility toggle (LegalLinksSection idiom) ───────────── */}
        <div style={ROW_STYLE}>
          <span className="inline-flex items-center gap-2" style={{ minWidth: 0 }}>
            <Globe
              size={16}
              aria-hidden="true"
              style={{ color: 'var(--fs-muted)', flexShrink: 0 }}
            />
            <span style={{ minWidth: 0 }}>
              <span
                id="profile-public-label"
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  color: 'var(--fs-ink)',
                }}
              >
                פרופיל ציבורי
              </span>
              <span style={HELPER_STYLE}>כשמופעל, אחרים יכולים לצפות בפרופיל שלך.</span>
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isPublic}
            aria-labelledby="profile-public-label"
            onClick={handleToggle}
            className="active:scale-[0.98]"
            style={{
              width: 52,
              height: 30,
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              flexShrink: 0,
              background: isPublic ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
              transition: 'background 0.15s ease',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 3,
                insetInlineStart: isPublic ? 25 : 3,
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: isPublic ? 'var(--color-ink-on-accent)' : 'var(--fs-muted)',
                transition: 'inset-inline-start 0.15s ease',
              }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfileEditSection;
