import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useInactivityTimer } from './useInactivityTimer';

const INACTIVITY_LIMIT = 2 * 60 * 1000;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useInactivityTimer', () => {
  it('does not call onTimeout when not authenticated', () => {
    const onTimeout = vi.fn();
    renderHook(() => useInactivityTimer(false, onTimeout));

    vi.advanceTimersByTime(INACTIVITY_LIMIT + 1000);

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('calls onTimeout after 2 minutes of inactivity', () => {
    const onTimeout = vi.fn();
    renderHook(() => useInactivityTimer(true, onTimeout));

    vi.advanceTimersByTime(INACTIVITY_LIMIT);

    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it('does not call onTimeout before 2 minutes', () => {
    const onTimeout = vi.fn();
    renderHook(() => useInactivityTimer(true, onTimeout));

    vi.advanceTimersByTime(INACTIVITY_LIMIT - 1);

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('resets the timer when a tracked activity event fires', () => {
    const onTimeout = vi.fn();
    renderHook(() => useInactivityTimer(true, onTimeout));

    // Advance almost to the timeout, then simulate activity
    vi.advanceTimersByTime(INACTIVITY_LIMIT - 1000);
    window.dispatchEvent(new Event('mousemove'));

    // Advance again — the full limit from the reset point has not passed yet
    vi.advanceTimersByTime(INACTIVITY_LIMIT - 1000);

    expect(onTimeout).not.toHaveBeenCalled();

    // Now let the full limit expire from the last activity
    vi.advanceTimersByTime(1001);
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it('clears the timer and listeners on unmount', () => {
    const onTimeout = vi.fn();
    const { unmount } = renderHook(() => useInactivityTimer(true, onTimeout));

    unmount();
    vi.advanceTimersByTime(INACTIVITY_LIMIT + 1000);

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('tears down when isAuthenticated goes false', () => {
    const onTimeout = vi.fn();
    const { rerender } = renderHook(
      ({ active }) => useInactivityTimer(active, onTimeout),
      { initialProps: { active: true } },
    );

    rerender({ active: false });
    vi.advanceTimersByTime(INACTIVITY_LIMIT + 1000);

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('always invokes the latest onTimeout reference', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ cb }) => useInactivityTimer(true, cb),
      { initialProps: { cb: first } },
    );

    rerender({ cb: second });
    vi.advanceTimersByTime(INACTIVITY_LIMIT);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });
});
