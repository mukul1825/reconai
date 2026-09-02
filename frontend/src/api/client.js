/**
 * Thin fetch wrapper around the ReconAI backend. Deliberately not axios -
 * fetch is sufficient for this surface area and it's one less dependency to
 * explain in a hiring interview about "why is this here."
 */

// In dev, this stays relative and goes through the Vite proxy (vite.config.js)
// straight to localhost:5000. In production there's no such proxy - Vercel
// serves static files with nothing else listening, so this MUST point at
// the deployed backend's full URL there. Set via VITE_API_BASE_URL in
// Vercel's project environment variables (e.g. https://reconai-backend.onrender.com/api/v1).
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

function getToken() {
  return localStorage.getItem("reconai_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = data?.error?.message || `Request failed (${res.status})`;
    const error = new Error(message);
    error.code = data?.error?.code;
    error.status = res.status;
    throw error;
  }

  return data;
}

export const api = {
  register: (email, password) =>
    request("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),

  login: (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  uploadBatch: (files) => {
    const form = new FormData();
    form.append("ledger", files.ledger);
    form.append("settlement", files.settlement);
    form.append("bank", files.bank);
    return request("/batches", { method: "POST", body: form });
  },

  getBatch: (batchId) => request(`/batches/${batchId}`),

  listBatches: (cursor) => {
    const query = cursor ? `?cursor=${cursor}&limit=10` : "?limit=10";
    return request(`/batches${query}`);
  },

  getExceptions: (batchId) => request(`/batches/${batchId}/exceptions`),

  getAudit: (batchId) => request(`/batches/${batchId}/audit`),

  resolveMatch: (matchId, decision, note) =>
    request(`/matches/${matchId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    }),
};

export function setToken(token) {
  localStorage.setItem("reconai_token", token);
}

export function clearToken() {
  localStorage.removeItem("reconai_token");
}

export function isAuthed() {
  return Boolean(getToken());
}
