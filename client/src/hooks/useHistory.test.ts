import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useHistory } from './useHistory';

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return { ...actual, fetchTranscriptions: vi.fn() };
});

import { fetchTranscriptions } from '../api';

const ITEMS = [
  { id: 1, text: 'hello', filename: 'rec.webm', createdAt: '2024-01-01T00:00:00Z' },
];

beforeEach(() => vi.clearAllMocks());

describe('useHistory', () => {
  it('starts with an empty history', () => {
    const { result } = renderHook(() => useHistory('', false));
    expect(result.current.history).toEqual([]);
  });

  it('does not fetch when not authenticated', () => {
    renderHook(() => useHistory('tok', false));
    expect(fetchTranscriptions).not.toHaveBeenCalled();
  });

  it('does not fetch when token is empty even if authenticated', () => {
    renderHook(() => useHistory('', true));
    expect(fetchTranscriptions).not.toHaveBeenCalled();
  });

  it('fetches history when authenticated with a token', async () => {
    vi.mocked(fetchTranscriptions).mockResolvedValueOnce(ITEMS);

    const { result } = renderHook(() => useHistory('tok', true));

    await waitFor(() => expect(result.current.history).toEqual(ITEMS));
    expect(fetchTranscriptions).toHaveBeenCalledWith('tok');
  });

  it('refresh() re-fetches and updates history', async () => {
    vi.mocked(fetchTranscriptions)
      .mockResolvedValueOnce(ITEMS)
      .mockResolvedValueOnce([...ITEMS, { id: 2, text: 'world', filename: 'r2.webm', createdAt: '2024-01-02T00:00:00Z' }]);

    const { result } = renderHook(() => useHistory('tok', true));
    await waitFor(() => expect(result.current.history).toHaveLength(1));

    await act(() => result.current.refresh());

    expect(result.current.history).toHaveLength(2);
    expect(fetchTranscriptions).toHaveBeenCalledTimes(2);
  });

  it('reset() clears history to empty array', async () => {
    vi.mocked(fetchTranscriptions).mockResolvedValueOnce(ITEMS);

    const { result } = renderHook(() => useHistory('tok', true));
    await waitFor(() => expect(result.current.history).toHaveLength(1));

    act(() => result.current.reset());

    expect(result.current.history).toEqual([]);
  });

  it('logs error and keeps history intact when fetch fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fetchTranscriptions).mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useHistory('tok', true));
    await waitFor(() => expect(consoleSpy).toHaveBeenCalled());

    expect(result.current.history).toEqual([]);
    consoleSpy.mockRestore();
  });
});
