import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, login, register, fetchTranscriptions, transcribeAudio } from "./api";
import type { HistoryItem, User } from "./types";
import AuthForm from "./components/AuthForm";
import RecorderPanel from "./components/RecorderPanel";
import HistorySidebar from "./components/HistorySidebar";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function pickMimeType(): string {
  if (typeof window === "undefined" || !window.MediaRecorder) return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const t of candidates) {
    if (window.MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

const MIME_TYPE = pickMimeType();

export default function App() {
  const [token, setToken] = useState<string>("");
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!token);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [recording, setRecording] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const chunksRef = useRef<BlobPart[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const fetchHistory = useCallback(async (authToken: string) => {
    try {
      const data = await fetchTranscriptions(authToken);
      setHistory(data);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchHistory(token);
    }
  }, [isAuthenticated, token, fetchHistory]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const INACTIVITY_LIMIT = 2 * 60 * 1000;
    let timeoutId: number;

    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        handleLogout();
        alert("You have been logged out due to inactivity.");
      }, INACTIVITY_LIMIT);
    };

    const activityEvents = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    activityEvents.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      window.clearTimeout(timeoutId);
      activityEvents.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [isAuthenticated]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);
    setIsVerifying(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const data = await (isRegistering ? register : login)(email, password);
      setToken(data.token);
      setUser(data.user);
      setIsAuthenticated(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setAuthError(err.message);
      } else {
        setAuthError("Could not connect to server. Check your connection or API URL.");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = () => {
    setToken("");
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
    setHistory([]);
    setTranscript("");
    setError(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  };

  const start = useCallback(async () => {
    setError(null);
    setTranscript("");
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, MIME_TYPE ? { mimeType: MIME_TYPE } : undefined);

      recorderRef.current = rec;
      chunksRef.current = [];

      rec.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());

        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        try {
          const data = await transcribeAudio(blob, token);
          setTranscript(data.text);
          fetchHistory(token);
        } catch (e: unknown) {
          if (e instanceof ApiError && e.status === 401) handleLogout();
          setError(getErrorMessage(e));
        }
      };

      rec.start();
      setRecording(true);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    }
  }, [token, fetchHistory]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      setRecording(false);
    }
  }, []);

  if (!isAuthenticated) {
    return (
      <AuthForm
        isRegistering={isRegistering}
        isVerifying={isVerifying}
        authError={authError}
        onSubmit={handleAuth}
        onToggleMode={() => {
          setIsRegistering(!isRegistering);
          setAuthError(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 md:p-8">
      <div className="max-w-4xl w-full flex flex-col md:flex-row gap-8">
        <RecorderPanel
          user={user}
          onLogout={handleLogout}
          recording={recording}
          onStart={start}
          onStop={stop}
          audioUrl={audioUrl}
          mimeType={MIME_TYPE}
          error={error}
          transcript={transcript}
        />
        <HistorySidebar history={history} />
      </div>

      <p className="mt-12 text-sm text-gray-500">
        For support, contact{" "}
        <a href="mailto:narmilas@proton.me" className="text-emerald-600 hover:underline font-medium">
          narmilas@proton.me
        </a>
      </p>
    </div>
  );
}
