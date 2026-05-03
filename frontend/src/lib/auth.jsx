import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { api, WS_URL, fmtErr } from "./api";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef(null);
  const [wsReady, setWsReady] = useState(false);
  const handlersRef = useRef(new Set());

  const addHandler = useCallback((fn) => {
    handlersRef.current.add(fn);
    return () => handlersRef.current.delete(fn);
  }, []);
  const wsSend = useCallback((obj) => {
    if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify(obj));
  }, []);

  const reconnectRef = useRef(null);

  const connectWs = useCallback((token) => {
    clearTimeout(reconnectRef.current);
    if (wsRef.current) try { wsRef.current.close(); } catch {}
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;
    ws.onopen = () => { console.log("[WS] connected"); setWsReady(true); };
    ws.onerror = (e) => console.error("[WS] error:", e.type);
    ws.onclose = (e) => {
      console.warn("[WS] closed — code:", e.code, "reason:", e.reason || "(none)", "clean:", e.wasClean);
      setWsReady(false);
      if (localStorage.getItem("token")) {
        reconnectRef.current = setTimeout(() => connectWs(token), 3000);
      }
    };
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        handlersRef.current.forEach((h) => h(data));
      } catch {}
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { setLoading(false); return; }
    api.get("/auth/me").then(r => { setUser(r.data); connectWs(token); }).catch(() => localStorage.removeItem("token")).finally(() => setLoading(false));
  }, [connectWs]);

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", data.token);
      setUser(data.user); connectWs(data.token);
      return { ok: true };
    } catch (e) { return { ok: false, error: fmtErr(e.response?.data?.detail) }; }
  };
  const register = async (email, password, name) => {
    try {
      const { data } = await api.post("/auth/register", { email, password, name });
      localStorage.setItem("token", data.token);
      setUser(data.user); connectWs(data.token);
      return { ok: true };
    } catch (e) { return { ok: false, error: fmtErr(e.response?.data?.detail) }; }
  };
  const logout = () => {
    clearTimeout(reconnectRef.current);
    localStorage.removeItem("token");
    try { wsRef.current?.close(); } catch {}
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, loading, login, register, logout, wsSend, wsReady, addHandler }}>{children}</AuthCtx.Provider>;
}
