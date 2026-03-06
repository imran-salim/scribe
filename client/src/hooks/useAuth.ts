import { useState, useEffect, useRef } from "react";
import { ApiError, login, register, logoutUser, refreshAccessToken } from "../api";
import type { User } from "../types";

// Refresh the access token 1 minute before the 15-minute JWT expiry.
const REFRESH_BEFORE_EXPIRY_MS = 14 * 60 * 1000;

export function useAuth() {
  const [token, setToken] = useState<string>("");
  const [storedRefreshToken, setStoredRefreshToken] = useState<string>("");
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const logout = async () => {
    if (token) {
      try {
        await logoutUser(token);
      } catch {
        // best-effort: clear local state regardless of API response
      }
    }
    setToken("");
    setStoredRefreshToken("");
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
  };

  // Keep a stable ref so the refresh timer can call the latest logout without
  // being listed as a dependency (which would cause the timer to reset on every render).
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  useEffect(() => {
    if (!storedRefreshToken || !isAuthenticated) return;

    const timer = setTimeout(async () => {
      try {
        const data = await refreshAccessToken(storedRefreshToken);
        setToken(data.token);
        setStoredRefreshToken(data.refreshToken);
      } catch {
        logoutRef.current();
      }
    }, REFRESH_BEFORE_EXPIRY_MS);

    return () => clearTimeout(timer);
  }, [storedRefreshToken, isAuthenticated]);

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
      setStoredRefreshToken(data.refreshToken);
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

  const toggleMode = () => {
    setIsRegistering((prev) => !prev);
    setAuthError(null);
  };

  return { token, user, isAuthenticated, isVerifying, isRegistering, authError, handleAuth, logout, toggleMode };
}
