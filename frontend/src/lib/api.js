import axios from "axios";

const BACKEND_HOST = `${window.location.hostname}:8000`;
export const API = `http://${BACKEND_HOST}/api`;
export const WS_URL = `ws://${BACKEND_HOST}/api/ws`;

export const api = axios.create({ baseURL: API });
api.interceptors.request.use((c) => {
  const t = localStorage.getItem("token");
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

export function fmtErr(d) {
  if (d == null) return "Something went wrong";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map(e => e?.msg || JSON.stringify(e)).join(", ");
  return d?.msg || String(d);
}
