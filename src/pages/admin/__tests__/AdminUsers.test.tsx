// ============================================================================
// AdminUsers — the operator screen's own behaviour: search, the three data
// states, and the per-row "set as coach" action. The service is mocked; the
// point here is that a refusal becomes Hebrew copy instead of a crash, and that
// the promote call carries the business name the operator typed.
// ============================================================================

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUser } from '../../../services/admin/adminService';

const listAdminUsers = vi.fn();
const setUserAsCoach = vi.fn();

vi.mock('../../../services/admin/adminService', () => ({
  ADMIN_USER_LIMIT: 25,
  listAdminUsers: (query: string, limit?: number) => listAdminUsers(query, limit),
  setUserAsCoach: (userId: string, businessName?: string | null) =>
    setUserAsCoach(userId, businessName),
}));

import AdminUsers from '../AdminUsers';

const trainee: AdminUser = {
  userId: 'u1',
  email: 'dana@example.com',
  displayName: 'דנה לוי',
  role: 'trainee',
};

const coach: AdminUser = {
  userId: 'u2',
  email: 'yossi@example.com',
  displayName: 'יוסי כהן',
  role: 'coach',
};

beforeEach(() => {
  vi.clearAllMocks();
  listAdminUsers.mockResolvedValue({ ok: true, data: [trainee, coach] });
  setUserAsCoach.mockResolvedValue({ ok: true, data: null });
});

describe('AdminUsers', () => {
  it('lists the recent users returned for an empty query', async () => {
    render(<AdminUsers />);

    expect(await screen.findByText('דנה לוי')).toBeInTheDocument();
    expect(screen.getByText('יוסי כהן')).toBeInTheDocument();
    expect(listAdminUsers).toHaveBeenCalledWith('', undefined);
  });

  it('passes the typed query to the service', async () => {
    render(<AdminUsers />);
    await screen.findByText('דנה לוי');

    await userEvent.type(screen.getByLabelText('חיפוש משתמש'), 'דנה');

    await waitFor(() => expect(listAdminUsers).toHaveBeenLastCalledWith('דנה', undefined));
  });

  it('shows the Hebrew empty state when a search matches nothing', async () => {
    listAdminUsers.mockResolvedValue({ ok: true, data: [] });

    render(<AdminUsers />);
    await userEvent.type(screen.getByLabelText('חיפוש משתמש'), 'zzz');

    expect(await screen.findByText('לא נמצא משתמש שמתאים לחיפוש')).toBeInTheDocument();
  });

  it('shows a Hebrew permission message with a retry path when the RPC refuses', async () => {
    listAdminUsers.mockResolvedValue({ ok: false, error: 'not_admin' });

    render(<AdminUsers />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('אין לך הרשאה לנהל משתמשים');

    listAdminUsers.mockResolvedValue({ ok: true, data: [trainee] });
    await userEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));

    expect(await screen.findByText('דנה לוי')).toBeInTheDocument();
  });

  it('sets a trainee as coach with the business name typed in the row form', async () => {
    render(<AdminUsers />);
    await screen.findByText('דנה לוי');

    await userEvent.click(screen.getByRole('button', { name: 'הגדרת דנה לוי כמאמן' }));

    const nameField = screen.getByLabelText('שם העסק');
    await userEvent.clear(nameField);
    await userEvent.type(nameField, 'סטודיו דנה');
    await userEvent.click(screen.getByRole('button', { name: 'הגדרה כמאמן' }));

    await waitFor(() => expect(setUserAsCoach).toHaveBeenCalledWith('u1', 'סטודיו דנה'));
  });

  it('offers no promote action on a row that is already a coach', async () => {
    render(<AdminUsers />);
    await screen.findByText('יוסי כהן');

    expect(screen.queryByRole('button', { name: 'הגדרת יוסי כהן כמאמן' })).not.toBeInTheDocument();
    expect(screen.getByText('מאמן')).toBeInTheDocument();
  });

  it('keeps the row form open and reports a failed promotion instead of crashing', async () => {
    setUserAsCoach.mockResolvedValue({ ok: false, error: 'server' });

    render(<AdminUsers />);
    await screen.findByText('דנה לוי');
    await userEvent.click(screen.getByRole('button', { name: 'הגדרת דנה לוי כמאמן' }));
    await userEvent.click(screen.getByRole('button', { name: 'הגדרה כמאמן' }));

    await waitFor(() => expect(setUserAsCoach).toHaveBeenCalled());
    // The form stays open so the operator can retry; no unhandled rejection.
    expect(screen.getByLabelText('שם העסק')).toBeInTheDocument();
  });
});
