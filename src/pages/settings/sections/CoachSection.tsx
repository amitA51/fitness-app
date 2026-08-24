import { ChevronLeft, ChevronRight, Dumbbell, UserCog, Users } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { showToast } from '../../../components/ui/GlobalToast';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { SettingsRow } from '../../../components/ui/SettingsRow';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import { useCoach } from '../../../contexts/CoachContext';
import { updateMyCoachProfile } from '../../../services/coach';
import { Divider } from '../components/Divider';
import { IconBox } from '../components/IconBox';
import { SavedIndicator } from '../components/SavedIndicator';
import { useSavedFlash } from '../hooks/useAutosave';

const DEBOUNCE_MS = 600;

/**
 * Coach section — Fresh Steel / Obsidian design language.
 *
 * Trainee view: explanation + "הפוך למאמן" (confirmed role change — the whole
 * app experience switches to the coach shell: coach home, coach nav).
 * Coach view: autosaving businessName + bio fields, navigation to /coach.
 */
export function CoachSection() {
  const { isCoach, coachProfile, loading, enable, disable } = useCoach();
  const navigate = useNavigate();
  const { saved, flash } = useSavedFlash();

  // Become-a-coach flow state
  const [enabling, setEnabling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Leave-coach-mode flow state
  const [leaving, setLeaving] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

  // Local field state (controlled inputs, debounced save)
  const [businessName, setBusinessName] = useState(coachProfile?.businessName ?? '');
  const [bio, setBio] = useState(coachProfile?.bio ?? '');
  const [businessNameError, setBusinessNameError] = useState<string | null>(null);
  const [bioError, setBioError] = useState<string | null>(null);

  const businessNameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bioTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Debounced save helpers ─────────────────────────────────────────────────

  const saveField = useCallback(
    async (
      updates: Parameters<typeof updateMyCoachProfile>[0],
      setError: (e: string | null) => void
    ) => {
      const { error } = await updateMyCoachProfile(updates);
      if (error) {
        setError(error);
      } else {
        setError(null);
        flash();
      }
    },
    [flash]
  );

  const handleBusinessNameChange = (value: string) => {
    setBusinessName(value);
    setBusinessNameError(null);
    if (businessNameTimer.current) clearTimeout(businessNameTimer.current);
    businessNameTimer.current = setTimeout(() => {
      void saveField({ businessName: value }, setBusinessNameError);
    }, DEBOUNCE_MS);
  };

  const handleBioChange = (value: string) => {
    setBio(value);
    setBioError(null);
    if (bioTimer.current) clearTimeout(bioTimer.current);
    bioTimer.current = setTimeout(() => {
      void saveField({ bio: value }, setBioError);
    }, DEBOUNCE_MS);
  };

  // ── Enable handler ─────────────────────────────────────────────────────────

  const handleEnable = async () => {
    setConfirmOpen(false);
    setEnabling(true);
    try {
      await enable();
      // Role flips to coach server-side; the app re-routes to the coach shell.
      showToast('החשבון הפך לחשבון מאמן', 'success');
      navigate('/coach');
    } catch {
      showToast('המעבר לחשבון מאמן נכשל', 'error');
    } finally {
      setEnabling(false);
    }
  };

  // ── Leave handler ───────────────────────────────────────────────────────────

  const handleLeave = async () => {
    setLeaveConfirmOpen(false);
    setLeaving(true);
    try {
      await disable();
      showToast('חזרת לחשבון מתאמן', 'success');
      navigate('/');
    } catch (err) {
      // The server refuses while active/pending client links exist.
      const message =
        err instanceof Error && err.message.includes('coach_has_active_clients')
          ? 'יש לכם מתאמנים פעילים. סיימו את הקשר איתם במסך המתאמנים ואז נסו שוב.'
          : 'היציאה מחשבון מאמן נכשלה. נסו שוב.';
      showToast(message, 'error');
    } finally {
      setLeaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  // Avoid flicker while context initialises
  if (loading) return null;

  // ── Trainee view: become a coach ────────────────────────────────────────────
  if (!isCoach) {
    return (
      <div className="mb-7">
        <SectionLabel>מאמן</SectionLabel>
        <SettingsCard>
          <div className="flex flex-col gap-4 ps-4 pe-4 py-4">
            <div className="flex items-start gap-3">
              <IconBox>
                <UserCog size={15} />
              </IconBox>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  lineHeight: '1.55',
                  color: 'var(--fs-muted)',
                  margin: 0,
                  flex: 1,
                }}
              >
                חשבון מאמן מאפשר לנהל מתאמנים: לראות את האימונים והתזונה שלהם, לשייך תוכניות ולשלוח
                הודעות.
              </p>
            </div>
            <Button
              variant="primary"
              shape="sharp"
              isLoading={enabling}
              onClick={() => setConfirmOpen(true)}
              aria-label="הפוך למאמן"
              fullWidth
            >
              הפוך למאמן
            </Button>
          </div>
        </SettingsCard>
        <ConfirmDialog
          isOpen={confirmOpen}
          variant="warning"
          title="להפוך לחשבון מאמן?"
          description="מסך הבית והניווט יתחלפו לממשק ניהול המתאמנים. האימונים האישיים שלך יישארו זמינים דרך ״האימונים שלי״. חשבון מאמן לא יכול להתחבר למאמן אחר."
          confirmLabel="הפוך למאמן"
          cancelLabel="ביטול"
          onConfirm={() => void handleEnable()}
          onCancel={() => setConfirmOpen(false)}
        />
      </div>
    );
  }

  // ── Coach view ──────────────────────────────────────────────────────────────

  // Determine RTL for chevron direction (Hebrew-first app is RTL by default)
  const isRTL = document.documentElement.dir !== 'ltr';
  const NavChevron = isRTL ? ChevronLeft : ChevronRight;

  return (
    <div className="mb-7">
      <SectionLabel trailing={<SavedIndicator saved={saved} />}>מאמן</SectionLabel>
      <SettingsCard>
        {/* Business name */}
        <div className="flex flex-col">
          <div className="flex items-center gap-3 ps-4 pe-4 py-3.5 min-h-[52px]">
            <IconBox>
              <Dumbbell size={15} />
            </IconBox>
            <span
              className="flex-1"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '15px',
                fontWeight: 500,
                color: 'var(--fs-ink)',
              }}
            >
              שם העסק
            </span>
            <input
              type="text"
              dir="auto"
              value={businessName}
              onChange={(e) => handleBusinessNameChange(e.target.value)}
              placeholder="שם העסק שלך..."
              aria-label="שם העסק"
              style={{
                width: '144px',
                minHeight: '44px',
                padding: '6px 10px',
                fontSize: '14px',
                backgroundColor: 'var(--fs-surface)',
                border: '1px solid var(--fs-surface-2)',
                borderRadius: 12,
                color: 'var(--fs-ink)',
                fontFamily: 'var(--font-body)',
                outline: 'none',
                textAlign: 'start',
              }}
            />
          </div>
          {businessNameError && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                color: 'var(--color-error)',
                marginInline: '16px',
                marginBottom: '8px',
                marginTop: 0,
              }}
              role="alert"
            >
              {businessNameError}
            </p>
          )}
          <Divider />
        </div>

        {/* Bio */}
        <div className="flex flex-col">
          <div className="flex items-start gap-3 ps-4 pe-4 py-3.5 min-h-[52px]">
            <IconBox>
              <Users size={15} />
            </IconBox>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '15px',
                fontWeight: 500,
                color: 'var(--fs-ink)',
                paddingTop: '2px',
                flexShrink: 0,
              }}
            >
              אודות
            </span>
            <textarea
              dir="auto"
              value={bio}
              onChange={(e) => handleBioChange(e.target.value)}
              placeholder="ספר על עצמך..."
              aria-label="אודות"
              rows={3}
              style={{
                flex: 1,
                minHeight: '72px',
                padding: '6px 10px',
                fontSize: '14px',
                backgroundColor: 'var(--fs-surface)',
                border: '1px solid var(--fs-surface-2)',
                borderRadius: 12,
                color: 'var(--fs-ink)',
                fontFamily: 'var(--font-body)',
                outline: 'none',
                resize: 'vertical',
                lineHeight: '1.5',
              }}
            />
          </div>
          {bioError && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                color: 'var(--color-error)',
                marginInline: '16px',
                marginBottom: '8px',
                marginTop: 0,
              }}
              role="alert"
            >
              {bioError}
            </p>
          )}
          <Divider />
        </div>

        {/* Navigate to coach dashboard */}
        <SettingsRow
          icon={
            <IconBox>
              <UserCog size={15} />
            </IconBox>
          }
          label="ניהול מתאמנים"
          divider
        >
          <button
            type="button"
            onClick={() => navigate('/coach')}
            aria-label="מעבר לניהול מתאמנים"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: 'var(--fs-muted)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <NavChevron size={18} aria-hidden="true" />
          </button>
        </SettingsRow>

        {/* Leave coach mode — the reversible exit (server refuses with active clients) */}
        <div className="flex flex-col gap-3 ps-4 pe-4 py-4">
          <Button
            variant="secondary"
            shape="sharp"
            isLoading={leaving}
            onClick={() => setLeaveConfirmOpen(true)}
            aria-label="חזרה לחשבון מתאמן"
            fullWidth
          >
            חזרה לחשבון מתאמן
          </Button>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: 'var(--fs-muted)',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            החשבון יחזור למצב מתאמן. אפשר לחזור למצב מאמן בכל עת.
          </p>
        </div>
      </SettingsCard>
      <ConfirmDialog
        isOpen={leaveConfirmOpen}
        variant="warning"
        title="לחזור לחשבון מתאמן?"
        description="מסך הבית והניווט יחזרו לחווית המתאמן. אי אפשר לצאת ממצב מאמן כשיש מתאמנים פעילים — סיימו אותם קודם במסך המתאמנים."
        confirmLabel="חזרה למתאמן"
        cancelLabel="ביטול"
        onConfirm={() => void handleLeave()}
        onCancel={() => setLeaveConfirmOpen(false)}
      />
    </div>
  );
}

export default CoachSection;
