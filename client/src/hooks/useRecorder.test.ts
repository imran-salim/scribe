import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useRecorder } from './useRecorder';

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return { ...actual, transcribeAudio: vi.fn() };
});

import { transcribeAudio, ApiError } from '../api';

// ---------------------------------------------------------------------------
// Browser API mocks
// ---------------------------------------------------------------------------
const mockTrackStop = vi.fn();
const mockStream = { getTracks: () => [{ stop: mockTrackStop }] };

const mockRecorderStart = vi.fn();
const mockRecorderStop = vi.fn();
let mockRecorderInstance: {
  start: typeof mockRecorderStart;
  stop: typeof mockRecorderStop;
  state: string;
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
};

const MockMediaRecorder = vi.fn(() => {
  mockRecorderInstance = {
    start: mockRecorderStart,
    stop: mockRecorderStop,
    state: 'inactive',
    mimeType: 'audio/webm',
    ondataavailable: null,
    onstop: null,
  };
  return mockRecorderInstance;
}) as unknown as typeof MediaRecorder;
(MockMediaRecorder as unknown as { isTypeSupported: () => boolean }).isTypeSupported = () => false;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('MediaRecorder', MockMediaRecorder);
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
  });
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  // Unmount hooks before removing stubs — the audioUrl cleanup effect calls
  // URL.revokeObjectURL on unmount, which must happen while the stub is live.
  cleanup();
  vi.unstubAllGlobals();
});

describe('useRecorder', () => {
  it('starts with idle state', () => {
    const { result } = renderHook(() => useRecorder('tok', vi.fn(), vi.fn()));

    expect(result.current.recording).toBe(false);
    expect(result.current.isStarting).toBe(false);
    expect(result.current.transcript).toBe('');
    expect(result.current.error).toBeNull();
    expect(result.current.audioUrl).toBeNull();
  });

  it('start() requests microphone access', async () => {
    const { result } = renderHook(() => useRecorder('tok', vi.fn(), vi.fn()));

    await act(() => result.current.start());

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
  });

  it('start() sets recording to true', async () => {
    const { result } = renderHook(() => useRecorder('tok', vi.fn(), vi.fn()));

    await act(() => result.current.start());

    expect(result.current.recording).toBe(true);
    expect(mockRecorderStart).toHaveBeenCalledOnce();
  });

  it('start() sets error and stays not-recording when getUserMedia rejects', async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
      new DOMException('Permission denied', 'NotAllowedError'),
    );

    const { result } = renderHook(() => useRecorder('tok', vi.fn(), vi.fn()));
    await act(() => result.current.start());

    expect(result.current.error).toMatch(/permission denied/i);
    expect(result.current.recording).toBe(false);
    expect(result.current.isStarting).toBe(false);
  });

  it('start() prevents concurrent calls while starting', async () => {
    const { result } = renderHook(() => useRecorder('tok', vi.fn(), vi.fn()));

    // Fire two concurrent start() calls without awaiting the first
    await act(async () => {
      result.current.start();
      result.current.start();
    });

    // getUserMedia should only be called once because isStarting gates the second call
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('stop() stops the recorder and sets recording to false', async () => {
    const { result } = renderHook(() => useRecorder('tok', vi.fn(), vi.fn()));
    await act(() => result.current.start());

    mockRecorderInstance.state = 'recording';
    act(() => result.current.stop());

    expect(mockRecorderStop).toHaveBeenCalledOnce();
    expect(result.current.recording).toBe(false);
  });

  it('stop() is a no-op when recorder is already inactive', () => {
    const { result } = renderHook(() => useRecorder('tok', vi.fn(), vi.fn()));
    // stop() before start() — recorderRef.current is null
    act(() => result.current.stop());
    expect(mockRecorderStop).not.toHaveBeenCalled();
  });

  it('reset() clears transcript, error, and audioUrl', async () => {
    vi.mocked(transcribeAudio).mockResolvedValueOnce({ text: 'hello' });

    const { result } = renderHook(() => useRecorder('tok', vi.fn(), vi.fn()));
    await act(() => result.current.start());

    // Simulate onstop to produce a transcript
    await act(async () => {
      mockRecorderInstance.onstop?.();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.transcript).toBe('hello'));

    act(() => result.current.reset());

    expect(result.current.transcript).toBe('');
    expect(result.current.error).toBeNull();
    expect(result.current.audioUrl).toBeNull();
  });

  it('onstop sets audioUrl and transcript on successful transcription', async () => {
    vi.mocked(transcribeAudio).mockResolvedValueOnce({ text: 'transcribed text' });
    const onTranscribed = vi.fn();

    const { result } = renderHook(() => useRecorder('tok', vi.fn(), onTranscribed));
    await act(() => result.current.start());

    await act(async () => {
      mockRecorderInstance.onstop?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.audioUrl).toBe('blob:mock-url');
      expect(result.current.transcript).toBe('transcribed text');
    });
    expect(onTranscribed).toHaveBeenCalledOnce();
  });

  it('onstop calls onUnauthorized and sets error on 401', async () => {
    vi.mocked(transcribeAudio).mockRejectedValueOnce(
      new ApiError('Session expired. Please log in again.', 401),
    );
    const onUnauthorized = vi.fn();

    const { result } = renderHook(() => useRecorder('tok', onUnauthorized, vi.fn()));
    await act(() => result.current.start());

    await act(async () => {
      mockRecorderInstance.onstop?.();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.error).toMatch(/session expired/i));
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('onstop sets error without calling onUnauthorized on non-401 failures', async () => {
    vi.mocked(transcribeAudio).mockRejectedValueOnce(new ApiError('Server error', 500));
    const onUnauthorized = vi.fn();

    const { result } = renderHook(() => useRecorder('tok', onUnauthorized, vi.fn()));
    await act(() => result.current.start());

    await act(async () => {
      mockRecorderInstance.onstop?.();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.error).toBe('Server error'));
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
