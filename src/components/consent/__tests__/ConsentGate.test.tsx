// ============================================================================
// ConsentGate + ConsentContext — a slow or unreachable server is not a reason
// to wall the app off.
//
// Any failed consent read used to raise the full-screen "terms updated" wall,
// and the app shell behind it unmounted and remounted every time the decision
// flickered. The gate now acts on the server's answer — live, or the last one
// stored for this user — and lets the user in when there is neither.
// ============================================================================

import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc } }));

/** An account old enough to fail open; a test switches to a brand-new one. */
const ESTABLISHED = '2026-01-01T00:00:00Z';
let createdAt = ESTABLISHED;
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ status: 'authenticated', user: { id: 'u1', created_at: createdAt } }),
}));

import { ConsentProvider, useConsent } from '../../../contexts/ConsentContext';
import { cacheConsentPending } from '../../../services/consent/consentService';
import { ConsentGate } from '../ConsentGate';

const pendingTermsRow = {
  doc_type: 'terms',
  current_version: '2.0',
  content_hash: 'hash',
  effective_date: '2026-01-01',
  accepted_version: null,
  needs_consent: true,
};

const networkDown = { data: null, error: { message: 'network', code: '08006' } };

let mounts = 0;
let refreshConsent: () => Promise<void> = async () => {};

/** Stands in for AppShell: counts mounts and exposes the context's refresh. */
function Shell() {
  const { refresh } = useConsent();
  refreshConsent = refresh;
  useEffect(() => {
    mounts += 1;
  }, []);
  return <div>APP SHELL</div>;
}

function renderGate() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ConsentProvider>
        <ConsentGate>
          <Shell />
        </ConsentGate>
      </ConsentProvider>
    </MemoryRouter>
  );
}

const WALL_TITLE = 'התנאים ומדיניות הפרטיות עודכנו';

beforeEach(() => {
  rpc.mockReset();
  localStorage.clear();
  mounts = 0;
  createdAt = ESTABLISHED;
});

describe('ConsentGate — last-known-good consent', () => {
  it('holds a brand-new account when the server is unreachable and nothing is stored', async () => {
    // Sign-up records no consent, so a new account may never have accepted.
    createdAt = new Date().toISOString();
    rpc.mockResolvedValue(networkDown);

    renderGate();

    expect(await screen.findByText(WALL_TITLE)).toBeInTheDocument();
    expect(screen.queryByText('APP SHELL')).not.toBeInTheDocument();
  });

  it('lets an established user in when the server is unreachable and nothing is stored (fail open)', async () => {
    rpc.mockResolvedValue(networkDown);

    renderGate();

    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(screen.getByText('APP SHELL')).toBeInTheDocument();
    expect(screen.queryByText(WALL_TITLE)).not.toBeInTheDocument();
  });

  it('keeps a previously cleared user in the app when the read fails', async () => {
    cacheConsentPending('u1', []);
    rpc.mockResolvedValue(networkDown);

    renderGate();

    expect(screen.getByText('APP SHELL')).toBeInTheDocument();
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(screen.queryByText(WALL_TITLE)).not.toBeInTheDocument();
  });

  it('raises the wall when the server explicitly says consent is needed', async () => {
    rpc.mockResolvedValue({ data: [pendingTermsRow], error: null });

    renderGate();

    expect(await screen.findByText(WALL_TITLE)).toBeInTheDocument();
    expect(screen.queryByText('APP SHELL')).not.toBeInTheDocument();
  });

  it('does not remount the app shell when consent is re-checked', async () => {
    cacheConsentPending('u1', []);
    rpc.mockResolvedValue({ data: [], error: null });
    renderGate();
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));

    rpc.mockResolvedValue(networkDown);
    await act(async () => {
      await refreshConsent();
    });

    expect(screen.getByText('APP SHELL')).toBeInTheDocument();
    expect(mounts).toBe(1);
  });
});
