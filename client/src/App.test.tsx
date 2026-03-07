import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import App from './App';

vi.mock('./hooks/useAuth');
vi.mock('./hooks/useHistory');
vi.mock('./hooks/useRecorder');
vi.mock('./hooks/useInactivityTimer');
vi.mock('./components/AuthForm', () => ({ default: () => <div>AuthForm</div> }));
vi.mock('./components/RecorderPanel', () => ({ default: () => <div>RecorderPanel</div> }));
vi.mock('./components/HistorySidebar', () => ({ default: () => <div>HistorySidebar</div> }));

import { useAuth } from './hooks/useAuth';
import { useHistory } from './hooks/useHistory';
import { useRecorder } from './hooks/useRecorder';
import { useInactivityTimer } from './hooks/useInactivityTimer';

const mockLogout = vi.fn();
const mockReset = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(useAuth).mockReturnValue({
    token: 'tok',
    user: { id: 1, email: 'a@b.com' },
    isAuthenticated: true,
    isRegistering: false,
    isVerifying: false,
    authError: null,
    logout: mockLogout,
    handleAuth: vi.fn(),
    toggleMode: vi.fn(),
  });

  vi.mocked(useHistory).mockReturnValue({
    history: [],
    refresh: vi.fn(),
    reset: mockReset,
  });

  vi.mocked(useRecorder).mockReturnValue({
    recording: false,
    isStarting: false,
    audioUrl: null,
    error: null,
    transcript: '',
    start: vi.fn(),
    stop: vi.fn(),
    reset: mockReset,
  });

  vi.mocked(useInactivityTimer).mockImplementation(() => {});
});

describe('App — inactivity timer integration', () => {
  it('passes auth.logout as the timeout callback to useInactivityTimer', () => {
    render(<App />);

    const [, onTimeout] = vi.mocked(useInactivityTimer).mock.calls[0];
    expect(typeof onTimeout).toBe('function');

    vi.spyOn(window, 'alert').mockImplementation(() => {});
    onTimeout();

    expect(mockLogout).toHaveBeenCalledOnce();
  });

  it('shows an inactivity alert when the timeout fires', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<App />);

    const [, onTimeout] = vi.mocked(useInactivityTimer).mock.calls[0];
    onTimeout();

    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/inactivity/i));
  });

  it('passes isAuthenticated to useInactivityTimer', () => {
    render(<App />);

    const [isAuthenticated] = vi.mocked(useInactivityTimer).mock.calls[0];
    expect(isAuthenticated).toBe(true);
  });
});
