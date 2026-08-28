// ============================================================================
// /nutrition route guard — the trainee nutrition screen is HIDDEN, not removed.
//
// NUTRITION_TRAINEE_UI_ENABLED (constants/featureFlags.ts) is off while the
// owner decides whether the nutrition feature stays. These tests pin both
// directions of that decision, because both are load-bearing:
//   • a normal trainee must NOT reach /nutrition (it is out of sight), and
//   • an app_admins member MUST reach it (the owner cannot judge a screen he
//     cannot open),
// plus the fact that flipping the one flag line restores the screen for
// everyone — that is what makes the hiding reversible rather than a deletion.
// ============================================================================

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppAdminState } from '../hooks/useIsAppAdmin';

let adminState: AppAdminState = { isAdmin: false, loading: false };

vi.mock('../hooks/useIsAppAdmin', () => ({
  useIsAppAdmin: () => adminState,
}));

// The flag is read at render time, so a getter lets one test flip it without
// re-importing the router. Mirrors the real module's single export.
let nutritionEnabled = false;
vi.mock('../constants/featureFlags', () => ({
  get NUTRITION_TRAINEE_UI_ENABLED() {
    return nutritionEnabled;
  },
}));

import { NutritionGuard } from '../AppRouter';

/** Mounts the guard at /nutrition with a distinguishable home route to land on. */
function renderAtNutrition() {
  return render(
    <MemoryRouter initialEntries={['/nutrition']}>
      <Routes>
        <Route
          path="/nutrition"
          element={
            <NutritionGuard>
              <div>NUTRITION SCREEN</div>
            </NutritionGuard>
          }
        />
        <Route path="/" element={<div>HOME</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  adminState = { isAdmin: false, loading: false };
  nutritionEnabled = false;
});

describe('NutritionGuard while the nutrition surface is hidden', () => {
  it('redirects a non-admin away from /nutrition without rendering the screen', () => {
    // Arrange — flag off, app_admins lookup settled: an ordinary trainee.
    nutritionEnabled = false;
    adminState = { isAdmin: false, loading: false };

    // Act
    renderAtNutrition();

    // Assert — bounced home, and the hidden screen never mounted.
    expect(screen.getByText('HOME')).toBeInTheDocument();
    expect(screen.queryByText('NUTRITION SCREEN')).not.toBeInTheDocument();
  });

  it('lets an app_admins member reach /nutrition normally', () => {
    // The owner has to be able to open the screen to decide whether to keep it.
    nutritionEnabled = false;
    adminState = { isAdmin: true, loading: false };

    renderAtNutrition();

    expect(screen.getByText('NUTRITION SCREEN')).toBeInTheDocument();
    expect(screen.queryByText('HOME')).not.toBeInTheDocument();
  });

  it('renders neither the screen nor the redirect while the admin check loads', () => {
    // Redirecting here would bounce a real admin home on every cold load.
    nutritionEnabled = false;
    adminState = { isAdmin: false, loading: true };

    renderAtNutrition();

    expect(screen.queryByText('NUTRITION SCREEN')).not.toBeInTheDocument();
    expect(screen.queryByText('HOME')).not.toBeInTheDocument();
  });

  it('becomes a pass-through for a non-admin once the flag is flipped back on', () => {
    // Proves the revert is genuinely one line: no admin, still reaches it.
    nutritionEnabled = true;
    adminState = { isAdmin: false, loading: false };

    renderAtNutrition();

    expect(screen.getByText('NUTRITION SCREEN')).toBeInTheDocument();
    expect(screen.queryByText('HOME')).not.toBeInTheDocument();
  });
});

describe('the /nutrition route is actually wired to the guard', () => {
  it('wraps the /nutrition route element in NutritionGuard', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');

    const source = readFileSync(join(__dirname, '..', 'AppRouter.tsx'), 'utf8');
    const at = source.indexOf('path="/nutrition"');

    expect(at, '/nutrition route not found in AppRouter.tsx').toBeGreaterThan(-1);
    const block = source.slice(at, at + 400);
    expect(block).toContain('<NutritionGuard>');
    expect(block).toContain('<Nutrition />');
  });
});
