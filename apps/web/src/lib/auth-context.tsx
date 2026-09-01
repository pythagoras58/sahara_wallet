"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { clearToken, getToken, saveToken } from "@/lib/api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  isLoggedIn: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    setStatus(getToken() ? "authenticated" : "unauthenticated");
  }, []);

  function login(token: string) {
    saveToken(token);
    setStatus("authenticated");
  }

  function logout() {
    clearToken();
    setStatus("unauthenticated");
  }

  return (
    <AuthContext.Provider value={{ status, isLoggedIn: status === "authenticated", login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
