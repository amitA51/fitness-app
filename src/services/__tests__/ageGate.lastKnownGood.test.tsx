// ============================================================================
// Age gate — a failed read must not ask a verified user for their birth date.
//
// Any error other than "table missing" used to fail CLOSED as "no record", which
// put "מה תאריך הלידה?" in front of every already-verified user whenever the
// database was slow. A failed read now falls back to the last server answer for
// this user; only a live "no row" answer asks for a date of birth.
// ============================================================================

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: h.maybeSingle })) })),
    })),
    rpc: h.rpc,
  },
}));

vi.mock('../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'u1' })),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ status: 'authenticated', user: { id: 'u1' }, clearGuest: vi.fn() }),
}));

import { AgeGate } from '../../components/consent/AgeGate';
import { AgeGateProvider } from '../../contexts/AgeGateContext';
import { AGE_LKG_TTL_MS, getAgeStatus, readCachedAgeStatus, setBirthDate } from '../ageGate';
import { getCurrentUser } from '../supabaseAuth';

const verifiedRow = {
  data: { age_verified: true, parental_consent_status: 'not_required' },
  error: null,
};
const underAgeRow = {
  data: { age_verified: false, parental_consent_status: 'pending' },
  error: null,
};
const noRow = { data: null, error: null };
const serverDown = { data: null, error: { message: 'upstream timeout', code: '57014' } };

const DOB_TITLE = 'מה תאריך הלידה?';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('getAgeStatus — last-known-good', () => {
  it('stores a live answer', async () => {
    h.maybeSingle.mockResolvedValue(verifiedRow);

    const status = await getAgeStatus();

    expect(status).toMatchObject({ hasRecord: true, ageVerified: true });
    expect(readCachedAgeStatus('u1')).toMatchObject({ hasRecord: true, ageVerified: true });
  });

  it('keeps a verified user verified when the read fails', async () => {
    h.maybeSingle.mockResolvedValueOnce(verifiedRow);
    await getAgeStatus();

    h.maybeSingle.mockResolvedValueOnce(serverDown);
    const status = await getAgeStatus();

    expect(status).toMatchObject({ hasRecord: true, ageVerified: true, unavailable: true });
  });

  it('keeps an under-age block when the read fails (going offline is no way around it)', async () => {
    h.maybeSingle.mockResolvedValueOnce(underAgeRow);
    await getAgeStatus();

    h.maybeSingle.mockResolvedValueOnce(serverDown);
    const status = await getAgeStatus();

    expect(status).toMatchObject({ hasRecord: true, ageVerified: false, unavailable: true });
  });

  it('fails OPEN (no DOB prompt) for an established account when the read fails and nothing is stored', async () => {
    h.maybeSingle.mockResolvedValue(serverDown);

    const status = await getAgeStatus({ id: 'u1', created_at: '2026-01-01T00:00:00Z' });

    expect(status).toMatchObject({ hasRecord: true, ageVerified: true, unavailable: true });
    expect(readCachedAgeStatus('u1')).toBeNull();
  });

  it('asks a NEW account for its date of birth when the read fails and nothing is stored', async () => {
    // Sign-up records no birth date: the gate is the only place it is asked.
    h.maybeSingle.mockResolvedValue(serverDown);

    const status = await getAgeStatus({ id: 'u1', created_at: new Date().toISOString() });

    expect(status).toMatchObject({ hasRecord: false, unavailable: true });
  });

  it('never lets a stored under-age block expire (only a live answer lifts it)', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() - AGE_LKG_TTL_MS - 1000);
    h.maybeSingle.mockResolvedValueOnce(underAgeRow);
    await getAgeStatus();
    clock.mockRestore();

    expect(readCachedAgeStatus('u1')).toMatchObject({ hasRecord: true, ageVerified: false });
  });

  it('lets a stored verified answer expire after the TTL', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() - AGE_LKG_TTL_MS - 1000);
    h.maybeSingle.mockResolvedValueOnce(verifiedRow);
    await getAgeStatus();
    clock.mockRestore();

    expect(readCachedAgeStatus('u1')).toBeNull();
  });

  it('reports "unavailable" (and re-checks) when the user lookup itself throws', async () => {
    vi.mocked(getCurrentUser).mockRejectedValueOnce(new Error('auth timeout'));

    const status = await getAgeStatus();

    expect(status.unavailable).toBe(true);
  });

  it('treats a thrown request (fetch timeout) like a failed read', async () => {
    h.maybeSingle.mockRejectedValue(new DOMException('no answer', 'TimeoutError'));

    const status = await getAgeStatus();

    expect(status).toMatchObject({ hasRecord: true, unavailable: true });
  });

  it('asks for a date of birth only on a live "no row" answer', async () => {
    h.maybeSingle.mockResolvedValue(noRow);

    const status = await getAgeStatus();

    expect(status.hasRecord).toBe(false);
    expect(status.unavailable).toBeUndefined();
  });

  it("stores set_birth_date's verdict so a failed re-read does not ask again", async () => {
    h.rpc.mockResolvedValue({ data: { age: 30, min_age: 16, verified: true }, error: null });
    await setBirthDate('1996-01-01');

    h.maybeSingle.mockResolvedValue(serverDown);
    const status = await getAgeStatus();

    expect(status).toMatchObject({ hasRecord: true, ageVerified: true });
  });
});

describe('AgeGate — a verified user never sees the DOB form on a failed read', () => {
  function renderGate() {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <AgeGateProvider>
          <AgeGate>
            <div>APP</div>
          </AgeGate>
        </AgeGateProvider>
      </MemoryRouter>
    );
  }

  it('shows the app (from the stored answer) while the server fails', async () => {
    h.maybeSingle.mockResolvedValueOnce(verifiedRow);
    await getAgeStatus();
    h.maybeSingle.mockResolvedValue(serverDown);

    renderGate();

    expect(screen.getByText('APP')).toBeInTheDocument();
    await waitFor(() => expect(h.maybeSingle).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(DOB_TITLE)).not.toBeInTheDocument();
  });

  it('still asks for the date of birth when the server answers "no row"', async () => {
    h.maybeSingle.mockResolvedValue(noRow);

    renderGate();

    expect(await screen.findByText(DOB_TITLE)).toBeInTheDocument();
  });
});
