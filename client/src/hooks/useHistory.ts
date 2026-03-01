import { useState, useEffect, useCallback } from "react";
import { fetchTranscriptions } from "../api";
import type { HistoryItem } from "../types";

export function useHistory(token: string, isAuthenticated: boolean) {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchTranscriptions(token);
      setHistory(data);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  }, [token]);

  useEffect(() => {
    if (isAuthenticated && token) refresh();
  }, [isAuthenticated, token, refresh]);

  const reset = useCallback(() => setHistory([]), []);

  return { history, refresh, reset };
}
