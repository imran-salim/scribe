import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth } from './useAuth';

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return { ...actual, login: vi.fn(), register: vi.fn(), logoutUser: vi.fn() };
});

import { login, register, logoutUser, ApiError } from '../api';

function makeFormEvent(email: string, password: string): React.FormEvent<HTMLFormElement> {
  const form = document.createElement('form');
  const emailInput = document.createElement('input');
  emailInput.name = 'email';
  emailInput.value = email;
  const passwordInput = document.createElement('input');
  passwordInput.name = 'password';
  passwordInput.value = password;
  form.appendChild(emailInput);
  form.appendChild(passwordInput);

  return { preventDefault: vi.fn(), currentTarget: form } as unknown as React.FormEvent<HTMLFormElement>;
}

beforeEach(() => vi.clearAllMocks());

describe('useAuth', () => {
  it('starts with empty auth state', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.token).toBe('');
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isVerifying).toBe(false);
    expect(result.current.isRegistering).toBe(false);
    expect(result.current.authError).toBeNull();
  });

  it('sets token, user, and isAuthenticated on successful login', async () => {
    const payload = { token: 'tok', user: { id: 1, email: 'a@b.com' } };
    vi.mocked(login).mockResolvedValueOnce(payload);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.handleAuth(makeFormEvent('a@b.com', 'pw')));

    expect(result.current.token).toBe('tok');
    expect(result.current.user).toEqual(payload.user);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.authError).toBeNull();
    expect(login).toHaveBeenCalledWith('a@b.com', 'pw');
  });

  it('calls register (not login) when isRegistering is true', async () => {
    vi.mocked(register).mockResolvedValueOnce({ token: 't', user: { id: 2, email: 'n@b.com' } });

    const { result } = renderHook(() => useAuth());
    act(() => result.current.toggleMode());
    await act(() => result.current.handleAuth(makeFormEvent('n@b.com', 'pw')));

    expect(register).toHaveBeenCalledWith('n@b.com', 'pw');
    expect(login).not.toHaveBeenCalled();
  });

  it('sets authError from ApiError message on auth failure', async () => {
    vi.mocked(login).mockRejectedValueOnce(new ApiError('Invalid credentials', 401));

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.handleAuth(makeFormEvent('a@b.com', 'bad')));

    expect(result.current.authError).toBe('Invalid credentials');
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('sets generic authError on network failure', async () => {
    vi.mocked(login).mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.handleAuth(makeFormEvent('a@b.com', 'pw')));

    expect(result.current.authError).toMatch(/could not connect/i);
  });

  it('always resets isVerifying after handleAuth resolves or rejects', async () => {
    vi.mocked(login).mockRejectedValueOnce(new ApiError('err', 401));

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.handleAuth(makeFormEvent('a@b.com', 'pw')));

    expect(result.current.isVerifying).toBe(false);
  });

  it('logout calls the backend with the current token and clears all auth state', async () => {
    vi.mocked(login).mockResolvedValueOnce({ token: 'tok', user: { id: 1, email: 'a@b.com' } });
    vi.mocked(logoutUser).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.handleAuth(makeFormEvent('a@b.com', 'pw')));
    await act(() => result.current.logout());

    expect(logoutUser).toHaveBeenCalledWith('tok');
    expect(result.current.token).toBe('');
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.authError).toBeNull();
  });

  it('logout clears state even when the backend call fails', async () => {
    vi.mocked(login).mockResolvedValueOnce({ token: 'tok', user: { id: 1, email: 'a@b.com' } });
    vi.mocked(logoutUser).mockRejectedValueOnce(new Error('network error'));

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.handleAuth(makeFormEvent('a@b.com', 'pw')));
    await act(() => result.current.logout());

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.token).toBe('');
  });

  it('toggleMode flips isRegistering and clears authError', async () => {
    vi.mocked(login).mockRejectedValueOnce(new ApiError('err', 401));

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.handleAuth(makeFormEvent('a@b.com', 'pw')));
    expect(result.current.authError).not.toBeNull();

    act(() => result.current.toggleMode());

    expect(result.current.isRegistering).toBe(true);
    expect(result.current.authError).toBeNull();
  });
});
