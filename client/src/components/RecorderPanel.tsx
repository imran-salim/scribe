import { useState } from "react";
import type { User } from "../types";

type Props = {
  user: User | null;
  onLogout: () => void;
  recording: boolean;
  isStarting: boolean;
  onStart: () => void;
  onStop: () => void;
  audioUrl: string | null;
  mimeType: string;
  error: string | null;
  transcript: string;
};

export default function RecorderPanel({ user, onLogout, recording, isStarting, onStart, onStop, audioUrl, mimeType, error, transcript }: Props) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(transcript).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }


  return (
    <div className="flex-1 bg-white shadow-xl rounded-2xl p-8 text-center relative h-fit">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900">Scribe</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 hidden sm:inline">{user?.email}</span>
          <button
            onClick={onLogout}
            className="text-gray-400 hover:text-gray-600 text-sm font-medium"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-8 justify-center">
        <button
          onClick={onStart}
          disabled={recording || isStarting}
          className="px-6 py-3 bg-emerald-600 text-white rounded-full font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-emerald-200"
        >
          {isStarting ? "Starting..." : "Start Recording"}
        </button>
        <button
          onClick={onStop}
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
            Format: {mimeType || "browser default"}
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
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl font-bold text-gray-800">Current Transcript</h2>
          {transcript && (
            <button
              onClick={handleCopy}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              title="Copy to clipboard"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
        </div>
        <div className="bg-gray-50 border border-gray-100 p-6 rounded-xl min-h-[150px]">
          <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
            {transcript || <span className="text-gray-400 italic">No transcript available yet. Start recording to see results.</span>}
          </p>
        </div>
      </div>
    </div>
  );
}
