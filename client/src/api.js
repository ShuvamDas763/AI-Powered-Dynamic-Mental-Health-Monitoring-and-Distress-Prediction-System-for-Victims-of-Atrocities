/**
 * Shared API utility with configurable base URL.
 *
 * In development, Vite proxies /api to localhost:3001 — same origin, no CORS.
 * In production, the frontend is on a different origin (Vercel) than the backend
 * (Render), so VITE_API_BASE is set to the backend URL at build time.
 */

const BASE = import.meta.env.VITE_API_BASE ?? '';

/**
 * Fetch wrapper for /api routes.
 *
 * @param {string} path - API path (e.g. '/auth/me')
 * @param {RequestInit} options - fetch options
 * @returns {Promise<{status: number, ok: boolean, body: any}>}
 */
export async function api(path, options = {}) {
  const response = await fetch(`${BASE}/api${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, body };
}
