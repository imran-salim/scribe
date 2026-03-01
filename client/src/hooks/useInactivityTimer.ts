import { useEffect, useRef } from "react";

export function useInactivityTimer(isAuthenticated: boolean, onTimeout: () => void) {
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (!isAuthenticated) return;

    const INACTIVITY_LIMIT = 2 * 60 * 1000;
    let timeoutId: number;

    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => onTimeoutRef.current(), INACTIVITY_LIMIT);
    };

    const activityEvents = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    activityEvents.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      window.clearTimeout(timeoutId);
      activityEvents.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [isAuthenticated]);
}
