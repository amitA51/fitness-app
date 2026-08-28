// ============================================================================
// /admin route guard — the client-side gate on the operator screen.
//
// Coach promotion now happens ONLY on /admin, so AdminGuard is the only thing
// standing between a curious logged-in user and that screen in the browser
// (the RPCs refuse a non-admin server-side regardless — that is the real
// boundary, tested in services/admin/__tests__/adminService.test.ts).
// These tests pin the three states of the guard, plus the two structural facts
// that make the screen hidden: /admin really is wrapped in AdminGuard, and
// nothing in the UI links to it.
// ============================================================================

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppAdminState } from '../hooks/useIsAppAdmin';

let adminState: AppAdminState = { isAdmin: false, loading: false };

vi.mock('../hooks/useIsAppAdmin', () => ({
  useIsAppAdmin: () => adminState,
}));

import { AdminGuard } from '../AppRouter';

const SRC = join(__dirname, '..');

/** Mounts the guard at /admin with a distinguishable home route to land on. */
function renderAtAdmin() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route
          path="/admin"
          element={
            <AdminGuard>
              <div>ADMIN SCREEN</div>
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

describe('AdminGuard', () => {
  it('redirects a non-admin who reaches /admin away, without rendering the screen', () => {
    // Arrange — the app_admins lookup has settled: not a member.
    adminState = { isAdmin: false, loading: false };

    // Act
    renderAtAdmin();

    // Assert — bounced to "/" and the operator screen never mounted.
    expect(screen.getByText('HOME')).toBeInTheDocument();
    expect(screen.queryByText('ADMIN SCREEN')).not.toBeInTheDocument();
  });

  it('renders neither the screen nor the redirect while the check is loading', () => {
    // A guard that redirected here would bounce a real admin home on every cold
    // load, before the answer is known.
    adminState = { isAdmin: false, loading: true };

    renderAtAdmin();

    expect(screen.queryByText('ADMIN SCREEN')).not.toBeInTheDocument();
    expect(screen.queryByText('HOME')).not.toBeInTheDocument();
  });

  it('renders the screen for an app_admins member', () => {
    adminState = { isAdmin: true, loading: false };

    renderAtAdmin();

    expect(screen.getByText('ADMIN SCREEN')).toBeInTheDocument();
    expect(screen.queryByText('HOME')).not.toBeInTheDocument();
  });
});

describe('/admin is registered behind the guard and stays hidden', () => {
  it('wraps the /admin route element in AdminGuard', () => {
    const source = readFileSync(join(SRC, 'AppRouter.tsx'), 'utf8');
    const at = source.indexOf('path="/admin"');

    expect(at, '/admin route not found in AppRouter.tsx').toBeGreaterThan(-1);
    const block = source.slice(at, at + 400);
    expect(block).toContain('<AdminGuard>');
    expect(block).toContain('<AdminUsers />');
  });

  it('is not linked from anywhere in the UI', () => {
    // The screen is reached by typing the URL. Only the files that implement it
    // may name the route; a nav link, redirect or menu entry elsewhere fails here.
    const allowed = [
      'AppRouter.tsx',
      join('pages', 'admin'),
      join('services', 'admin'),
      'useIsAppAdmin.ts',
    ];

    const walk = (dir: string, acc: string[] = []): string[] => {
      for (const name of readdirSync(dir).sort()) {
        if (name === 'test' || name === '__tests__' || name.startsWith('.')) continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path, acc);
        else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) acc.push(path);
      }
      return acc;
    };

    const offenders = walk(SRC)
      .map((path) => relative(SRC, path))
      .filter((rel) => !allowed.some((a) => rel.includes(a)))
      .filter((rel) => readFileSync(join(SRC, rel), 'utf8').includes('/admin'));

    expect(
      offenders,
      `/admin referenced outside the admin screen:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
