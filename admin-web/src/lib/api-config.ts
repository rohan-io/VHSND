// Thin fetch wrapper for local-api (see ../../local-api/README.md). Server
// components call these directly; client components use them inside
// useMutation. `cache: 'no-store'` throughout — this is live, mutable local
// dev data, never safe to let Next.js's fetch cache serve stale copies of.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export class ApiError extends Error {}

const REQUEST_TIMEOUT_MS = 10_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...init?.headers }
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(`Timed out reaching the local API server at ${API_BASE}.`);
    }
    throw new ApiError(`Cannot reach the local API server at ${API_BASE}.`, { cause: err });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.error || body?.detail || `Request failed (${res.status})`);
  }
  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

export const apiGet = <T>(path: string) => request<T>(path);
export const apiPost = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const apiPatch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
