// ============================================================================
// ADMIN — USERS (route /admin, deliberately hidden: no nav link anywhere).
//
// The ONLY coach-creation surface in the app. Search a user, set them as coach
// with an optional business name. Nothing else lives here on purpose: no stats,
// no charts, no bulk actions. The real gate is the database
// (admin_list_users / admin_set_coach both refuse a non-admin); this screen and
// the route guard are UX only.
// ============================================================================

import { ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../components/ui/GlobalToast';
import { Input } from '../../components/ui/Input';
import { SkeletonBox } from '../../components/ui/SkeletonLoader';
import {
  type AdminErrorCode,
  type AdminUser,
  listAdminUsers,
  setUserAsCoach,
} from '../../services/admin/adminService';

/** Service failure code to the user-facing Hebrew message. */
export function adminErrorMessage(error: AdminErrorCode): string {
  switch (error) {
    case 'not_admin':
      return 'אין לך הרשאה לנהל משתמשים';
    case 'unavailable':
      return 'אין חיבור לשרת. נסה שוב מאוחר יותר.';
    default:
      return 'טעינת המשתמשים נכשלה. נסה שוב.';
  }
}

/** Keystroke-to-request delay, so typing a name is one search and not eight. */
const SEARCH_DEBOUNCE_MS = 300;

export default function AdminUsers() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminErrorCode | null>(null);
  const [tick, setTick] = useState(0);

  // Which row has its "set as coach" form open, plus that form's state.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `tick` is a re-run trigger, not a value the body reads (same pattern as coach/_shared useAsyncData)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const timer = window.setTimeout(() => {
      void listAdminUsers(query).then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setUsers(result.data);
          setError(null);
        } else {
          setUsers([]);
          setError(result.error);
        }
        setLoading(false);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, tick]);

  const openForm = (user: AdminUser) => {
    setOpenFor(user.userId);
    setBusinessName(user.displayName ?? '');
  };

  const closeForm = () => {
    setOpenFor(null);
    setBusinessName('');
  };

  const confirmSetCoach = async (user: AdminUser) => {
    setSavingId(user.userId);
    const result = await setUserAsCoach(user.userId, businessName);
    setSavingId(null);

    if (result.ok) {
      showToast('החשבון הוגדר כמאמן', 'success');
      closeForm();
      reload();
      return;
    }
    showToast(
      result.error === 'not_admin' ? adminErrorMessage(result.error) : 'ההגדרה כמאמן נכשלה',
      'error'
    );
  };

  return (
    <div
      dir="rtl"
      lang="he"
      className="min-h-screen min-h-[100dvh]"
      style={{ background: 'var(--fs-bg)' }}
    >
      <div style={{ maxWidth: 720, marginInline: 'auto' }}>
        <header
          className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: '1px solid var(--fs-surface-2)' }}
        >
          <ShieldCheck
            size={20}
            aria-hidden="true"
            className="shrink-0"
            style={{ color: 'var(--fs-muted)' }}
          />
          <div className="flex-1 min-w-0">
            <h1
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--fs-heading)',
                margin: 0,
              }}
            >
              ניהול משתמשים
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: 'var(--fs-muted)',
                margin: 0,
              }}
            >
              הדרך היחידה להגדיר חשבון כמאמן.
            </p>
          </div>
        </header>

        <div className="px-5 py-5">
          <Input
            label="חיפוש משתמש"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="שם או כתובת אימייל"
            autoComplete="off"
            className="mb-5"
          />

          {loading ? (
            <div role="status" aria-busy="true" aria-label="טוען משתמשים" className="space-y-2">
              {[0, 1, 2, 3].map((row) => (
                <SkeletonBox key={row} height={68} width="100%" />
              ))}
            </div>
          ) : error ? (
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
                  margin: 0,
                }}
              >
                {adminErrorMessage(error)}
              </p>
              <Button variant="secondary" size="sm" onClick={reload}>
                נסה שוב
              </Button>
            </div>
          ) : users.length === 0 ? (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                color: 'var(--fs-muted)',
                textAlign: 'center',
                padding: '24px 16px',
                margin: 0,
              }}
            >
              {query.trim() ? 'לא נמצא משתמש שמתאים לחיפוש' : 'אין משתמשים להצגה'}
            </p>
          ) : (
            <ul className="list-none p-0 m-0">
              {users.map((user) => {
                const label = user.displayName ?? user.email ?? user.userId;
                const isOpen = openFor === user.userId;
                return (
                  <li
                    key={user.userId}
                    className="px-4 py-3"
                    style={{
                      background: 'var(--fs-surface)',
                      border: '1px solid var(--fs-surface-2)',
                      marginBottom: 8,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: 15,
                            fontWeight: 600,
                            color: 'var(--fs-ink)',
                          }}
                        >
                          {/* User-generated, may be Latin inside the RTL layout. */}
                          <bdi>{label}</bdi>
                        </div>
                        {user.email && (
                          <bdi
                            dir="ltr"
                            className="block"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 11,
                              color: 'var(--fs-muted)',
                            }}
                          >
                            {user.email}
                          </bdi>
                        )}
                      </div>

                      {user.role === 'coach' ? (
                        <span
                          className="shrink-0 px-2.5 py-1"
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--fs-muted)',
                            border: '1px solid var(--fs-surface-2)',
                            borderRadius: 'var(--radius-full)',
                          }}
                        >
                          מאמן
                        </span>
                      ) : (
                        !isOpen && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="shrink-0"
                            aria-label={`הגדרת ${label} כמאמן`}
                            onClick={() => openForm(user)}
                          >
                            הגדרה כמאמן
                          </Button>
                        )
                      )}
                    </div>

                    {isOpen && (
                      <div
                        className="mt-3 pt-3 flex flex-col gap-3"
                        style={{ borderTop: '1px solid var(--fs-surface-2)' }}
                      >
                        <Input
                          label="שם העסק"
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          placeholder="לא חובה"
                          autoComplete="off"
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            loading={savingId === user.userId}
                            loadingLabel="מגדיר…"
                            onClick={() => void confirmSetCoach(user)}
                          >
                            הגדרה כמאמן
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={savingId === user.userId}
                            onClick={closeForm}
                          >
                            ביטול
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
