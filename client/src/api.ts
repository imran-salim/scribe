import type { AuthResponse, HistoryItem, TranscriptionResponse } from "./types";

export type { AuthResponse, HistoryItem, TranscriptionResponse } from "./types";
export type { User } from "./types";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || "Authentication failed", res.status);
  return data;
}

export async function register(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || "Registration failed", res.status);
  return data;
}

export async function refreshAccessToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || "Token refresh failed", res.status);
  return data;
}

export async function logoutUser(token: string): Promise<void> {
  await fetch(`${BASE}/auth/logout`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` },
  });
}

export async function fetchTranscriptions(token: string, limit = 50, offset = 0): Promise<HistoryItem[]> {
  const res = await fetch(`${BASE}/transcriptions?limit=${limit}&offset=${offset}`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
  return res.json();
}

export async function transcribeAudio(blob: Blob, token: string): Promise<TranscriptionResponse> {
  const type = blob.type;
  const ext = type.includes("mp4")
    ? "m4a"
    : type.includes("mpeg") || type.includes("mp3")
      ? "mp3"
      : type.includes("wav")
        ? "wav"
        : "webm";

  const fd = new FormData();
  fd.append("audio", blob, `recording.${ext}`);

  const res = await fetch(`${BASE}/transcribe`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` },
    body: fd,
  });

  if (!res.ok) {
    if (res.status === 401) throw new ApiError("Session expired. Please log in again.", 401);
    const msg = await res.text();
    throw new ApiError(msg || `HTTP ${res.status}`, res.status);
  }

  return res.json();
}
