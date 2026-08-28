// ============================================================================
// /paywall route guard — the paywall is an ADMIN-ONLY SCAFFOLD, not a product.
//
// The billing stack in pages/billing is complete and deliberately switched off:
// no monetization model, price or tier has been chosen. Until one is, the
// screen exists only so the owner can look at it, so both directions are
// load-bearing:
//   • an ordinary trainee must NOT reach /paywall — there is nothing to sell
//     them, and a dead purchase screen is worse than no screen, and
//   • an app_admins member MUST reach it (the owner cannot judge a screen he
//     cannot open),
// plus the loading contract: the guard renders NOTHING until the app_admins
// lookup settles, or a real admin is bounced home on every cold load.
//
// The guard itself is AdminGuard, shared with /admin and unit-tested in
// adminRouteGuard.test.tsx. What these tests pin is that /paywall is actually
// mounted behind it.
// ============================================================================

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppAdminState } from '../hooks/useIsAppAdmin';

let adminState: AppAdminState = { isAdmin: false, loading: false };

vi.mock('../hooks/useIsAppAdmin', () => ({
  useIsAppAdmin: () => adminState,
}));

import { AdminGuard } from '../AppRouter';

/** Mounts the guard at /paywall with a distinguishable home route to land on. */
function renderAtPaywall() {
  return render(
    <MemoryRouter initialEntries={['/paywall']}>
      <Routes>
        <Route
          path="/paywall"
          element={
            <AdminGuard>
              <div>PAYWALL SCREEN</div>
            </AdminGuard>
          }
        />
        <Route path="/" element={<div>HOME</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  adminState = { isAdmin: false, loading: false };
});

describe('/paywall is reachable only by an app admin', () => {
  it('redirects a non-admin away from /paywall without rendering the screen', () => {
    // Arrange — the app_admins lookup has settled: an ordinary trainee.
    adminState = { isAdmin: false, loading: false };

    // Act
    renderAtPaywall();

    // Assert — bounced home, and the purchase screen never mounted.
    expect(screen.getByText('HOME')).toBeInTheDocument();
    expect(screen.queryByText('PAYWALL SCREEN')).not.toBeInTheDocument();
  });

  it('lets an app_admins member reach /paywall normally', () => {
    // The owner has to be able to open the scaffold to decide anything about it.
    adminState = { isAdmin: true, loading: false };

    renderAtPaywall();

    expect(screen.getByText('PAYWALL SCREEN')).toBeInTheDocument();
    expect(screen.queryByText('HOME')).not.toBeInTheDocument();
  });

  it('renders neither the screen nor the redirect while the admin check loads', () => {
    // Redirecting here would bounce a real admin home on every cold load.
    adminState = { isAdmin: false, loading: true };

    renderAtPaywall();

    expect(screen.queryByText('PAYWALL SCREEN')).not.toBeInTheDocument();
    expect(screen.queryByText('HOME')).not.toBeInTheDocument();
  });
});

describe('the /paywall route is actually wired to the guard', () => {
  it('wraps the /paywall route element in AdminGuard', () => {
    const source = readFileSync(join(__dirname, '..', 'AppRouter.tsx'), 'utf8');
    const at = source.indexOf('path="/paywall"');

    expect(at, '/paywall route not found in AppRouter.tsx').toBeGreaterThan(-1);
    const block = source.slice(at, at + 400);
    expect(block).toContain('<AdminGuard>');
    expect(block).toContain('<PaywallScreen />');
  });

  it('no longer redirects to /paywall when a legacy template quota rejection arrives', () => {
    // The free-plan quota trigger was dropped on 2026-08-24, so the branch that
    // used to push the user to the upgrade screen can never fire. Both create
    // paths now map a stale rejection to a message only — no navigation.
    const source = readFileSync(
      join(__dirname, '..', 'pages', 'templates', 'hooks', 'useTemplates.ts'),
      'utf8'
    );

    expect(source).not.toContain("navigate('/paywall')");
  });
});
