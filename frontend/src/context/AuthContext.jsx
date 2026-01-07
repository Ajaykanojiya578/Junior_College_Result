// src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from "react";
import api from "../services/api";
import { logout as apiLogout } from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(!user); // if no user, try to validate with server

  // persist to localStorage
  useEffect(() => {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [user]);

  // Try to validate with server on mount or when `user` changes.
  // Prefer an impersonation token stored in sessionStorage (tab-scoped)
  // so admin can open teacher panel in a separate tab without affecting
  // the admin session in the original tab.
  useEffect(() => {
    let mounted = true;
    async function check() {
      try {
        // Only consider an impersonation token if we're on the teacher pages
        const impersonateToken = sessionStorage.getItem("impersonateToken");
        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        const onTeacherPath = path && path.startsWith('/teacher');
        if (impersonateToken && onTeacherPath) {
          // api interceptor will pick impersonation token from sessionStorage
          const res = await api.get("/auth/me");
          if (mounted) setUser({ ...(res.data || {}), token: impersonateToken, impersonated: true });
          return;
        }

        if (user) {
          if (mounted) setLoading(false);
          return;
        }

        const res = await api.get("/auth/me");
        if (mounted) setUser(res.data || null);
      } catch (err) {
        // ignore — no valid session
      } finally {
        if (mounted) setLoading(false);
      }
    }
    check();
    return () => {
      mounted = false;
    };
  }, [user]);

  const login = async (data) => {
    if (!data || !data.token) {
      throw new Error("Missing authentication token");
    }

    // Temporarily store token so the api client can use it for /auth/me.
    // If verification fails, remove the token and propagate the error so
    // the caller can show an appropriate message and no session is created.
    localStorage.setItem("authToken", data.token);

    try {
      const me = await api.get("/auth/me");
      const userObj = { ...(me.data || {}), role: data.role, token: data.token };
      setUser(userObj);
      return userObj;
    } catch (err) {
      // verification failed -> remove transient token and rethrow
      localStorage.removeItem("authToken");
      throw err;
    }
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch (err) {
      console.warn("server logout failed:", err);
    }
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("authToken");
    // clear any impersonation keys in this tab
    try {
      sessionStorage.removeItem("impersonateToken");
      sessionStorage.removeItem("impersonateTeacherId");
      sessionStorage.removeItem("impersonateTeacherName");
    } catch (e) {
      // ignore
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
