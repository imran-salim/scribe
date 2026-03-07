import { useState, useCallback, useEffect, useRef } from "react";
import { ApiError, transcribeAudio } from "../api";

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

export const MIME_TYPE = pickMimeType();

export function useRecorder(
  token: string,
  onUnauthorized: () => void,
  onTranscribed: () => void,
) {
  const [recording, setRecording] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const chunksRef = useRef<BlobPart[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isStartingRef = useRef<boolean>(false);

  // Refs keep callbacks stable so start() doesn't need them as deps.
  const onUnauthorizedRef = useRef(onUnauthorized);
  const onTranscribedRef = useRef(onTranscribed);
  onUnauthorizedRef.current = onUnauthorized;
  onTranscribedRef.current = onTranscribed;

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const start = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setIsStarting(true);
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
      streamRef.current = stream;
      chunksRef.current = [];

      rec.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        recorderRef.current = null;

        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));

        try {
          const data = await transcribeAudio(blob, token);
          setTranscript(data.text);
          onTranscribedRef.current();
        } catch (e: unknown) {
          if (e instanceof ApiError && e.status === 401) onUnauthorizedRef.current();
          setError(getErrorMessage(e));
        }
      };

      rec.start();
      setRecording(true);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      isStartingRef.current = false;
      setIsStarting(false);
    }
  }, [token]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      setRecording(false);
    }
  }, []);

  const reset = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    recorderRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    chunksRef.current = [];
    setRecording(false);
    setTranscript("");
    setError(null);
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  return { recording, isStarting, transcript, error, audioUrl, start, stop, reset };
}
