import { useState } from "react";
import { ApiError, login, register } from "../api";
import type { User } from "../types";

export function useAuth() {
  const [token, setToken] = useState<string>("");
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

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

  const logout = () => {
    setToken("");
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
  };

  const toggleMode = () => {
    setIsRegistering((prev) => !prev);
    setAuthError(null);
  };

  return { token, user, isAuthenticated, isVerifying, isRegistering, authError, handleAuth, logout, toggleMode };
}
