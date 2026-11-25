import type { ErrorCode } from '@ligungi/protocol';
import { inActivity } from './discord/activity.ts';
import { errorText, getT } from './i18n/index.ts';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | null;
  /** The whole error body, for the fields some codes carry (when a suspension ends, for example). */
  readonly data: Readonly<Record<string, unknown>>;

  constructor(status: number, code: ErrorCode | null, message: string, data: Readonly<Record<string, unknown>> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

const request = async <T,>(method: string, path: string, body?: unknown): Promise<T> => {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: {
      ...(method === 'GET' ? {} : { 'content-type': 'application/json' }),
      // Inside Discord the session cookie must be the kind a third-party frame keeps; the server tells by this header.
      ...(inActivity ? { 'x-ligungi-activity': '1' } : {}),
    },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  if (!res.ok) {
    const { code, error } = (data ?? {}) as { code?: ErrorCode; error?: string };
    throw new ApiError(res.status, code ?? null, errorText(getT(), code, error), (data ?? {}) as Record<string, unknown>);
  }
  return data as T;
};

export const api = {
  get: <T,>(path: string) => request<T>('GET', path),
  post: <T,>(path: string, body?: unknown) => request<T>('POST', path, body),
  delete: <T,>(path: string) => request<T>('DELETE', path),
};
