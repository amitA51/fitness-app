// ============================================================================
// MY COACH — trainee view: assignments inbox, coaches, consent management
// ============================================================================

import { ImagePlus, MessageSquare, Play, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { showToast } from '../components/ui/GlobalToast';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { useAuth } from '../contexts/AuthContext';
import { syncTemplatesFromCloud } from '../hooks/useCloudTemplateReflection';
import {
  disconnectCoach,
  listMyAssignments,
  listMyCoaches,
  resolveProgramDays,
  submitCheckIn,
  subscribeToAssignments,
  updateCheckInPhotos,
  uploadCheckInPhotos,
} from '../services/coach';
import { listGroupThreads } from '../services/coach/groupMessageService';
import type { Assignment, GroupThreadSummary } from '../types/coach';
import {
  CoachPage,
  ListRow,
  ListSkeleton,
  Section,
  formatDate,
  useAsyncData,
} from './coach/_shared';
import { inviteErrorMessage, useAcceptInvite } from './coach/useAcceptInvite';

const KIND_LABEL: Record<Assignment['kind'], string> = {
  program: 'תוכנית אימון',
  nutrition_target: 'יעד תזונה',
  note: 'המלצה',
  announcement: 'הודעה',
};

export default function MyCoach() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    data: coaches,
    loading: coachesLoading,
    error: coachesError,
    reload,
  } = useAsyncData(() => listMyCoaches('active'), []);
  const {
    data: assignments,
    loading: aLoading,
    error: assignmentsError,
    reload: reloadAssignments,
  } = useAsyncData(() => listMyAssignments(), []);
  const { data: groups, loading: groupsLoading } = useAsyncData<GroupThreadSummary[]>(
    () => listGroupThreads('member'),
    []
  );
  const [code, setCode] = useState('');
  const { busy, accept } = useAcceptInvite();
  const [startingId, setStartingId] = useState<string | null>(null);

  // Live inbox: reflect coach actions (program/note/announcement) the moment they land.
  useEffect(() => {
    if (!user?.id) return;
    return subscribeToAssignments(user.id, reloadAssignments);
  }, [user?.id, reloadAssignments]);

  // Start a coach-assigned program: ensure the referenced template is synced
  // into the local-first store, then enter the existing ActiveWorkout flow.
  // When called with an explicit templateId (multi-day), that overrides a.templateId.
  const startProgram = async (a: Assignment, templateId?: string) => {
    const id = templateId ?? a.templateId;
    if (!id) return;
    setStartingId(a.id);
    try {
      await syncTemplatesFromCloud();
      navigate(`/workout/${id}`);
    } catch {
      setStartingId(null);
      showToast('לא ניתן להתחיל את האימון', 'error');
    }
  };

  // Manual code entry. Shares one accept path with JoinPage via useAcceptInvite.
  const connect = async () => {
    if (!code.trim()) return;
    const res = await accept(code);
    if (res.ok) {
      setCode('');
      reload();
      showToast('התחברת למאמן', 'success');
    } else {
      showToast(inviteErrorMessage(res.error), 'error');
    }
  };

  return (
    <CoachPage title="המאמן שלי" subtitle="My Coach" onBack={() => navigate('/')}>
      <Section title="חיבור למאמן">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input
              label="קוד הזמנה"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void connect();
                }
              }}
              placeholder="ABC123"
              dir="ltr"
              aria-label="קוד הזמנה"
              style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}
            />
          </div>
          <Button variant="primary" isLoading={busy} disabled={!code.trim()} onClick={connect}>
            התחבר
          </Button>
        </div>
      </Section>

      <Section title="המאמנים שלי">
        {coachesLoading ? (
          <ListSkeleton rows={2} />
        ) : coachesError ? (
          <SectionError onRetry={reload} />
        ) : coaches.length === 0 ? (
          <EmptyState
            illustration="generic"
            title="עדיין לא התחברת למאמן"
            description="הזן קוד הזמנה למעלה כדי להתחבר למאמן."
          />
        ) : (
          coaches.map((c) => (
            <ListRow
              key={c.id}
              label={c.coachProfile?.displayName ?? 'מאמן'}
              meta={`מחובר מאז ${formatDate(c.consentAt ?? c.createdAt)}`}
              trailing={
                <div className="flex gap-2 items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="שלח הודעה למאמן"
                    onClick={() => navigate(`/my-coach/messages/${c.coachId}`)}
                    className="shrink-0"
                  >
                    <MessageSquare size={15} aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    style={{ color: 'var(--fs-muted)' }}
                    onClick={async () => {
                      await disconnectCoach(c.id);
                      reload();
                      showToast('המאמן נותק', 'success');
                    }}
                  >
                    נתק
                  </Button>
                </div>
              }
            />
          ))
        )}
      </Section>

      {/* הקבוצות שלי — show only when groups exist; invisible to non-grouped trainees */}
      {groupsLoading && coaches.length > 0 ? (
        <Section title="הקבוצות שלי">
          <ListSkeleton rows={2} />
        </Section>
      ) : groups.length > 0 ? (
        <Section title="הקבוצות שלי">
          {groups.map((g) => (
            <ListRow
              key={g.groupId}
              label={g.name}
              metaNode={
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--fs-muted)',
                    marginTop: 2,
                    display: 'flex',
                    gap: 8,
                    alignItems: 'baseline',
                  }}
                >
                  {g.lastBody && (
                    <span
                      dir="auto"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {g.lastBody.length > 60 ? `${g.lastBody.slice(0, 60)}…` : g.lastBody}
                    </span>
                  )}
                  <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {formatDate(g.lastAt)}
                  </span>
                </div>
              }
              trailing={
                g.unread > 0 ? (
                  <span
                    dir="ltr"
                    aria-label={`${g.unread} הודעות שלא נקראו`}
                    style={{
                      background: 'var(--fs-primary)',
                      color: 'var(--fs-accent)',
                      borderRadius: 999,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 7px',
                      minWidth: 20,
                      textAlign: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {g.unread}
                  </span>
                ) : undefined
              }
              onClick={() => navigate(`/my-coach/groups/${g.groupId}/chat`)}
            />
          ))}
        </Section>
      ) : null}

      <CheckInForm />

      <Section title="היסטוריית שיוכים">
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            color: 'var(--fs-muted)',
            lineHeight: 1.6,
            marginBottom: 12,
          }}
        >
          תוכניות האימון מופיעות במסך האימון, ויעדי התזונה במסך התזונה. כאן מרוכזת היסטוריית כל מה
          שהמאמן שלח אליך.
        </p>
        {aLoading ? (
          <ListSkeleton rows={3} />
        ) : assignmentsError ? (
          <SectionError onRetry={reloadAssignments} />
        ) : assignments.length === 0 ? (
          <EmptyState
            illustration="notes"
            title="אין המלצות או שיוכים עדיין"
            description="כשהמאמן ישלח תוכנית או המלצה, היא תופיע כאן."
          />
        ) : (
          assignments.map((a) => {
            // Resolve program days: for a group program each member sees ONLY
            // their own per-member templates (payload.memberDays[myId]); direct
            // programs fall back to the flat payload.days. Malformed refs filtered.
            const days = resolveProgramDays(a, user?.id ?? '');

            const hasMultiDays = days.length > 0;

            // Build compact macro meta line for nutrition_target rows.
            const macroMeta =
              a.kind === 'nutrition_target' ? (
                <span
                  style={{
                    display: 'block',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: 'var(--fs-muted)',
                    marginTop: 2,
                  }}
                >
                  {typeof a.payload.calories === 'number' && (
                    <>
                      {'קלוריות: '}
                      <span dir="ltr">{a.payload.calories}</span>
                    </>
                  )}
                  {typeof a.payload.protein === 'number' && (
                    <>
                      {' · חלבון: '}
                      <span dir="ltr">{a.payload.protein}</span>
                      {' גרם'}
                    </>
                  )}
                  {typeof a.payload.carbs === 'number' && (
                    <>
                      {' · פחמימות: '}
                      <span dir="ltr">{a.payload.carbs}</span>
                      {' גרם'}
                    </>
                  )}
                  {typeof a.payload.fat === 'number' && (
                    <>
                      {' · שומן: '}
                      <span dir="ltr">{a.payload.fat}</span>
                      {' גרם'}
                    </>
                  )}
                </span>
              ) : null;

            return (
              <ListRow
                key={a.id}
                label={a.title || KIND_LABEL[a.kind]}
                meta={`${KIND_LABEL[a.kind]} · ${formatDate(a.createdAt)}${
                  typeof a.payload.text === 'string' ? ` · ${a.payload.text}` : ''
                }${a.kind !== 'nutrition_target' && typeof a.payload.calories === 'number' ? ` · ${a.payload.calories} קל'` : ''}`}
                metaNode={macroMeta ?? undefined}
                trailing={
                  a.kind === 'program' ? (
                    hasMultiDays ? (
                      // Multi-day program: one start button per day, stacked vertically.
                      <div className="flex flex-col gap-1">
                        {days.map((day) => (
                          <Button
                            key={day.templateId}
                            variant="primary"
                            size="sm"
                            icon={<Play size={14} aria-hidden="true" />}
                            isLoading={startingId === a.id}
                            onClick={() => startProgram(a, day.templateId)}
                            style={{ minHeight: 44, width: '100%', justifyContent: 'flex-start' }}
                          >
                            <bdi>{day.name}</bdi>
                          </Button>
                        ))}
                      </div>
                    ) : a.templateId ? (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<Play size={14} aria-hidden="true" />}
                        isLoading={startingId === a.id}
                        onClick={() => startProgram(a)}
                        style={{ minHeight: 44 }}
                      >
                        התחל אימון
                      </Button>
                    ) : undefined
                  ) : undefined
                }
              />
            );
          })
        )}
      </Section>
    </CoachPage>
  );
}

const MAX_CHECKIN_PHOTOS = 4;

/** A staged (not-yet-uploaded) photo: the source file plus its preview URL. */
interface StagedPhoto {
  file: File;
  url: string;
}

function CheckInForm() {
  const [weight, setWeight] = useState('');
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Mirror the latest staged set so the unmount cleanup revokes the real URLs
  // (a [] effect would otherwise capture the initial empty array and leak them).
  const photosRef = useRef(photos);
  photosRef.current = photos;

  // Revoke any outstanding object URLs on unmount to avoid leaking them.
  useEffect(() => {
    return () => {
      for (const p of photosRef.current) URL.revokeObjectURL(p.url);
    };
  }, []);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setPhotoError(null);
    const incoming = Array.from(fileList);
    const room = MAX_CHECKIN_PHOTOS - photos.length;
    if (room <= 0) {
      setPhotoError(`אפשר לצרף עד ${MAX_CHECKIN_PHOTOS} תמונות`);
      return;
    }
    const accepted = incoming.slice(0, room).map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    if (incoming.length > room) setPhotoError(`אפשר לצרף עד ${MAX_CHECKIN_PHOTOS} תמונות`);
    setPhotos((prev) => [...prev, ...accepted]);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
    setPhotoError(null);
  };

  const submit = async () => {
    setBusy(true);
    const { error, id } = await submitCheckIn({
      weight: weight ? Number(weight) : null,
      mood,
      energy,
      notes,
    });
    if (error) {
      setBusy(false);
      showToast('שמירת הצ׳ק-אין נכשלה', 'error');
      return;
    }

    // Upload photos AFTER the row exists (path needs its id). A per-photo
    // failure is surfaced inline but never blocks the saved check-in itself.
    if (id && photos.length > 0) {
      const { refs, errors } = await uploadCheckInPhotos(
        id,
        photos.map((p) => p.file)
      );
      if (refs.length > 0) await updateCheckInPhotos(id, refs);
      if (errors.length > 0) setPhotoError('חלק מהתמונות לא הועלו');
    }

    setBusy(false);
    for (const p of photos) URL.revokeObjectURL(p.url);
    setWeight('');
    setMood(null);
    setEnergy(null);
    setNotes('');
    setPhotos([]);
    setPhotoError(null);
    showToast('הצ׳ק-אין נשמר', 'success');
  };

  return (
    <Section title="צ׳ק-אין שבועי">
      <div className="mb-3">
        <Input
          label="משקל"
          type="number"
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="0.0"
          aria-label="משקל"
          unit='ק"ג'
        />
      </div>
      {/* Mood: 5 buttons, each ≥44×44 (flex-1 row keeps them tappable + aligned). */}
      <div className="flex gap-2 mb-3" role="group" aria-label="מצב רוח">
        {[1, 2, 3, 4, 5].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMood(m)}
            aria-label={`מצב רוח ${m} מתוך 5`}
            aria-pressed={mood === m}
            className="flex-1 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-0"
            style={{
              minWidth: 44,
              minHeight: 44,
              background: mood === m ? 'var(--fs-primary)' : 'var(--fs-surface)',
              color: mood === m ? 'var(--fs-accent)' : 'var(--fs-muted)',
              border: '1px solid var(--fs-surface-2)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {m}
          </button>
        ))}
      </div>
      {/* Energy: identical pattern to mood selector above. */}
      <div className="flex gap-2 mb-3" role="group" aria-label="אנרגיה">
        {[1, 2, 3, 4, 5].map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEnergy(e)}
            aria-label={`אנרגיה ${e} מתוך 5`}
            aria-pressed={energy === e}
            className="flex-1 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-0"
            style={{
              minWidth: 44,
              minHeight: 44,
              background: energy === e ? 'var(--fs-primary)' : 'var(--fs-surface)',
              color: energy === e ? 'var(--fs-accent)' : 'var(--fs-muted)',
              border: '1px solid var(--fs-surface-2)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="mb-3">
        <Textarea
          label="הערות"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="איך עבר השבוע?"
          aria-label="הערות צ׳ק-אין"
        />
      </div>

      {/* תמונות התקדמות — file input visually replaced by a 44px+ labelled button */}
      <div className="mb-4">
        <span
          className="block mb-2"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.22em',
            fontWeight: 600,
            color: 'var(--fs-muted)',
            textTransform: 'uppercase',
          }}
        >
          תמונות התקדמות
        </span>

        {/* The native input stays in the DOM (keyboard/SR reach it) but is hidden;
            the labelled button below triggers it. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="sr-only"
          aria-label="הוספת תמונות התקדמות"
          onChange={(e) => {
            addFiles(e.target.files);
            // Allow re-picking the same file after a remove.
            e.target.value = '';
          }}
        />

        {photos.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mb-2">
            {photos.map((p, i) => (
              <div
                key={p.url}
                className="relative"
                style={{
                  aspectRatio: '1 / 1',
                  background: 'var(--fs-surface-2)',
                  border: '1px solid var(--fs-surface-2)',
                }}
              >
                <img
                  src={p.url}
                  alt={`תמונת התקדמות ${i + 1}`}
                  className="w-full h-full"
                  style={{ objectFit: 'cover' }}
                />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  aria-label={`הסרת תמונה ${i + 1}`}
                  className="absolute active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)]"
                  style={{
                    top: 2,
                    insetInlineEnd: 2,
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--fs-primary)',
                    color: 'var(--color-ink-on-dark)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        {photos.length < MAX_CHECKIN_PHOTOS && (
          <Button
            variant="secondary"
            fullWidth
            icon={<ImagePlus size={16} aria-hidden="true" />}
            onClick={() => fileInputRef.current?.click()}
            style={{ minHeight: 44 }}
          >
            הוספת תמונות התקדמות
          </Button>
        )}

        {/* Inline error BELOW the control — not a toast (field-level). */}
        {photoError && (
          <p
            role="alert"
            className="mt-2"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.04em',
              color: 'var(--fs-warn)',
            }}
          >
            {photoError}
          </p>
        )}

        <p
          className="mt-2"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            color: 'var(--fs-muted)',
            lineHeight: 1.5,
          }}
        >
          התמונות פרטיות — רק המאמן שלך יכול לצפות בהן. אפשר לצרף עד{' '}
          <span dir="ltr">{MAX_CHECKIN_PHOTOS}</span> תמונות.
        </p>
      </div>

      <Button variant="primary" fullWidth isLoading={busy} onClick={submit}>
        שמור צ׳ק-אין
      </Button>
    </Section>
  );
}

/**
 * Inline load-failure state for a coach Section: distinct from the empty state,
 * with an explicit Hebrew message and a retry path. Proportional to InlineEmpty
 * (no full-screen illustration); tokenized for light + dark.
 */
function SectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 text-center"
      style={{
        padding: '20px 16px',
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          color: 'var(--fs-muted)',
          lineHeight: 1.6,
        }}
      >
        לא ניתן לטעון את הנתונים. בדוק את החיבור לאינטרנט ונסה שוב.
      </p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        נסה שוב
      </Button>
    </div>
  );
}
