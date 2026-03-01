import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { login, register, fetchTranscriptions, transcribeAudio, ApiError } from './api';

const BASE = 'http://localhost:8000';

function mockFetch(ok: boolean, status: number, body: unknown, mode: 'json' | 'text' = 'json') {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok,
    status,
    json: mode === 'json' ? async () => body : async () => { throw new Error('not json'); },
    text: mode === 'text' ? async () => body : async () => '',
  } as unknown as Response);
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => vi.unstubAllGlobals());

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------
describe('login', () => {
  it('returns token and user on success', async () => {
    const payload = { token: 'tok', user: { id: 1, email: 'a@b.com' } };
    mockFetch(true, 200, payload);

    const result = await login('a@b.com', 'pw');

    expect(result).toEqual(payload);
    expect(fetch).toHaveBeenCalledWith(`${BASE}/auth/login`, expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'pw' }),
    }));
  });

  it('throws ApiError with server message on HTTP error', async () => {
    mockFetch(false, 401, { error: 'Invalid credentials' });

    const err = await login('a@b.com', 'bad').catch(e => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('Invalid credentials');
    expect(err.status).toBe(401);
  });

  it('uses fallback message when server sends no error field', async () => {
    mockFetch(false, 500, {});

    const err = await login('a@b.com', 'pw').catch(e => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('Authentication failed');
  });
});

// ---------------------------------------------------------------------------
// register
// ---------------------------------------------------------------------------
describe('register', () => {
  it('returns token and user on success', async () => {
    const payload = { token: 'tok', user: { id: 2, email: 'new@b.com' } };
    mockFetch(true, 201, payload);

    const result = await register('new@b.com', 'pw');

    expect(result).toEqual(payload);
    expect(fetch).toHaveBeenCalledWith(`${BASE}/auth/register`, expect.anything());
  });

  it('throws ApiError on failure', async () => {
    mockFetch(false, 409, { error: 'Email taken' });

    const err = await register('taken@b.com', 'pw').catch(e => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('Email taken');
    expect(err.status).toBe(409);
  });

  it('uses fallback message when server sends no error field', async () => {
    mockFetch(false, 500, {});

    const err = await register('a@b.com', 'pw').catch(e => e);

    expect(err.message).toBe('Registration failed');
  });
});

// ---------------------------------------------------------------------------
// fetchTranscriptions
// ---------------------------------------------------------------------------
describe('fetchTranscriptions', () => {
  it('returns history array on success', async () => {
    const history = [{ id: 1, text: 'hello', filename: 'rec.webm', createdAt: '2024-01-01T00:00:00Z' }];
    mockFetch(true, 200, history);

    const result = await fetchTranscriptions('my-token');

    expect(result).toEqual(history);
    expect(fetch).toHaveBeenCalledWith(`${BASE}/transcriptions`, {
      headers: { Authorization: 'Bearer my-token' },
    });
  });

  it('throws ApiError on HTTP error', async () => {
    mockFetch(false, 401, null);

    const err = await fetchTranscriptions('bad-token').catch(e => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// transcribeAudio
// ---------------------------------------------------------------------------
describe('transcribeAudio', () => {
  it('returns transcription text on success', async () => {
    mockFetch(true, 200, { text: 'hello world' });

    const blob = new Blob(['audio'], { type: 'audio/webm' });
    const result = await transcribeAudio(blob, 'tok');

    expect(result).toEqual({ text: 'hello world' });
    expect(fetch).toHaveBeenCalledWith(
      `${BASE}/transcribe`,
      expect.objectContaining({ method: 'POST', headers: { Authorization: 'Bearer tok' } }),
    );
  });

  it('appends file with correct extension for mp4 blobs', async () => {
    mockFetch(true, 200, { text: '' });

    const blob = new Blob(['audio'], { type: 'audio/mp4' });
    await transcribeAudio(blob, 'tok');

    const body = vi.mocked(fetch).mock.calls[0][1]?.body as FormData;
    expect((body.get('audio') as File).name).toBe('recording.m4a');
  });

  it('appends file with correct extension for mp3 blobs', async () => {
    mockFetch(true, 200, { text: '' });

    const blob = new Blob(['audio'], { type: 'audio/mpeg' });
    await transcribeAudio(blob, 'tok');

    const body = vi.mocked(fetch).mock.calls[0][1]?.body as FormData;
    expect((body.get('audio') as File).name).toBe('recording.mp3');
  });

  it('throws ApiError with status 401 on unauthorized', async () => {
    mockFetch(false, 401, null);

    const err = await transcribeAudio(new Blob([]), 'expired').catch(e => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.message).toBe('Session expired. Please log in again.');
  });

  it('throws ApiError with response text on other HTTP errors', async () => {
    mockFetch(false, 500, 'Internal server error', 'text');

    const err = await transcribeAudio(new Blob([]), 'tok').catch(e => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('Internal server error');
    expect(err.status).toBe(500);
  });
});
