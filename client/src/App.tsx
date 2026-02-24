import { useCallback, useEffect, useRef, useState } from "react";

type TranscriptionResponse = {
  text: string;
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
  const [password, setPassword] = useState<string>(localStorage.getItem("scribe_password") || "");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!password);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [recording, setRecording] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const chunksRef = useRef<BlobPart[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError(null);
    setIsVerifying(true);

    const formData = new FormData(e.currentTarget);
    const pwd = formData.get("password") as string;
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/verify`, {
        headers: {
          "Authorization": `Bearer ${pwd}`,
        },
      });

      if (res.ok) {
        localStorage.setItem("scribe_password", pwd);
        setPassword(pwd);
        setIsAuthenticated(true);
      } else {
        setLoginError("Invalid password. Please try again.");
      }
    } catch (err) {
      setLoginError("Could not connect to server. Check your connection or API URL.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("scribe_password");
    setPassword("");
    setIsAuthenticated(false);
    setLoginError(null);
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
              "Authorization": `Bearer ${password}`,
            },
            body: fd,
          });

          if (!res.ok) {
            if (res.status === 401) {
              handleLogout();
              throw new Error("Invalid password. Please log in again.");
            }
            const msg = await res.text();
            throw new Error(msg || `HTTP ${res.status}`);
          }

          const data = (await res.json()) as TranscriptionResponse;
          setTranscript(data.text);
        } catch (e: unknown) {
          setError(getErrorMessage(e));
        }
      };

      rec.start();
      setRecording(true);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    }
  }, [password]);

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
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                name="password"
                placeholder="Enter password"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                required
                disabled={isVerifying}
              />
            </div>
            {loginError && (
              <p className="text-red-500 text-sm font-medium">{loginError}</p>
            )}
            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying ? "Verifying..." : "Unlock"}
            </button>
          </form>
          <p className="mt-8 text-sm text-gray-500">
            Need access? Contact{" "}
            <a href="mailto:narmilas@proton.me" className="text-emerald-600 hover:underline font-medium">
              narmilas@proton.me
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white shadow-xl rounded-2xl p-8 text-center relative">
        <button 
          onClick={handleLogout}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-sm font-medium"
        >
          Logout
        </button>
        <h1 className="text-4xl font-extrabold text-gray-900 mb-8">Scribe</h1>

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

        {audioUrl && (
          <div className="mb-8 space-y-2">
            <audio controls src={audioUrl} className="mx-auto" />
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
          <h2 className="text-xl font-bold text-gray-800 mb-3">Transcript</h2>
          <div className="bg-gray-50 border border-gray-100 p-6 rounded-xl min-h-[150px]">
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {transcript || <span className="text-gray-400 italic">No transcript available yet. Start recording to see results.</span>}
            </p>
          </div>
        </div>

        <p className="mt-8 text-sm text-gray-500">
          For support or access, contact{" "}
          <a href="mailto:narmilas@proton.me" className="text-emerald-600 hover:underline font-medium">
            narmilas@proton.me
          </a>
        </p>
      </div>
    </div>
  );
}
