import { useCallback, useEffect, useRef, useState } from "react";

type TranscriptionResponse = {
  text: string;
}

type User = {
  id: number;
  email: string;
}

type HistoryItem = {
  id: number;
  text: string;
  filename: string;
  createdAt: string;
}

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
  const [token, setToken] = useState<string>(localStorage.getItem("scribe_token") || "");
  const [user, setUser] = useState<User | null>(JSON.parse(localStorage.getItem("scribe_user") || "null"));
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
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/transcriptions`, {
        headers: {
          "Authorization": `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
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
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
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
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const endpoint = isRegistering ? "/auth/register" : "/auth/login";
      const res = await fetch(`${apiUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("scribe_token", data.token);
        localStorage.setItem("scribe_user", JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        setIsAuthenticated(true);
      } else {
        setAuthError(data.error || "Authentication failed");
      }
    } catch (err) {
      setAuthError("Could not connect to server. Check your connection or API URL.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("scribe_token");
    localStorage.removeItem("scribe_user");
    setToken("");
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
    setHistory([]);
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

        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        try {
          const fd = new FormData();
          const type = blob.type;
          const ext = type.includes("mp4")
            ? "m4a"
            : type.includes("mpeg") || type.includes("mp3")
              ? "mp3"
              : type.includes("wav")
                ? "wav"
                : "webm";

          fd.append("audio", blob, `recording.${ext}`);

          const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
          const res = await fetch(`${apiUrl}/transcribe`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
            },
            body: fd,
          });

          if (!res.ok) {
            if (res.status === 401) {
              handleLogout();
              throw new Error("Session expired. Please log in again.");
            }
            const msg = await res.text();
            throw new Error(msg || `HTTP ${res.status}`);
          }

          const data = (await res.json()) as TranscriptionResponse;
          setTranscript(data.text);
          fetchHistory(token);
        } catch (e: unknown) {
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-8">Scribe</h1>
            <h2 className="text-xl font-bold text-gray-700 mb-6">
              {isRegistering ? "Create an account" : "Sign in"}
            </h2>
          {/* <h2 className="text-xl font-bold text-gray-700 mb-6">
            {"Sign in"}
          </h2>  */}
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <input
                type="email"
                name="email"
                placeholder="Email address"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                required
                disabled={isVerifying}
              />
            </div>
            <div>
              <input
                type="password"
                name="password"
                placeholder="Password"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                required
                disabled={isVerifying}
              />
            </div>
            {authError && (
              <p className="text-red-500 text-sm font-medium">{authError}</p>
            )}
            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying ? "Processing..." : isRegistering ? "Register" : "Sign In"}
              {/* {isVerifying ? "Processing..." : "Sign In"} */}
            </button>
          </form>
          
          
          <button
            onClick={() => {
              setIsRegistering(!isRegistering);
              setAuthError(null);
            }}
            className="mt-6 text-sm text-emerald-600 hover:underline font-medium"
          >
            {isRegistering ? "Already have an account? Sign in" : "Need an account? Register"}
          </button>
         

          <div className="mt-6 text-sm text-gray-400 font-medium">
            Registration is currently disabled.
          </div>

          <p className="mt-8 text-sm text-gray-500">
            For support, contact{" "}
            <a href="mailto:narmilas@proton.me" className="text-emerald-600 hover:underline font-medium">
              narmilas@proton.me
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 md:p-8">
      <div className="max-w-4xl w-full flex flex-col md:flex-row gap-8">
        {/* Main Recorder Section */}
        <div className="flex-1 bg-white shadow-xl rounded-2xl p-8 text-center relative h-fit">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-extrabold text-gray-900">Scribe</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500 hidden sm:inline">{user?.email}</span>
              <button 
                onClick={handleLogout}
                className="text-gray-400 hover:text-gray-600 text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="flex gap-4 mb-8 justify-center">
            <button
              onClick={start}
              disabled={recording}
              className="px-6 py-3 bg-emerald-600 text-white rounded-full font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-emerald-200"
            >
              Start Recording
            </button>
            <button
              onClick={stop}
              disabled={!recording}
              className="px-6 py-3 bg-red-700 text-white rounded-full font-bold hover:bg-red-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-red-300"
            >
              Stop & Transcribe
            </button>
          </div>

          {recording && (
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-red-600 font-bold animate-pulse">Recording...</span>
            </div>
          )}

          {audioUrl && (
            <div className="mb-8 space-y-2">
              <audio controls src={audioUrl} className="mx-auto w-full" />
              <div className="text-xs text-gray-400">
                Format: {MIME_TYPE || "browser default"}
              </div>
            </div>
          )}

          {error && (
            <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm text-left">
              <p className="font-bold mb-1">Error:</p>
              <pre className="whitespace-pre-wrap font-mono">{error}</pre>
            </div>
          )}

          <div className="text-left">
            <h2 className="text-xl font-bold text-gray-800 mb-3">Current Transcript</h2>
            <div className="bg-gray-50 border border-gray-100 p-6 rounded-xl min-h-[150px]">
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                {transcript || <span className="text-gray-400 italic">No transcript available yet. Start recording to see results.</span>}
              </p>
            </div>
          </div>
        </div>

        {/* History Sidebar */}
        <div className="w-full md:w-80 bg-white shadow-xl rounded-2xl p-6 h-fit max-h-[80vh] overflow-y-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-4">History</h2>
          {history.length === 0 ? (
            <p className="text-gray-400 text-sm italic">No past transcriptions found.</p>
          ) : (
            <div className="space-y-4">
              {history.map((item) => (
                <div key={item.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-700 line-clamp-3">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
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
