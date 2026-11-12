import type { ErrorCode } from '@ligungi/protocol';
import { errorText, getT } from './i18n/index.ts';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | null;

  constructor(status: number, code: ErrorCode | null, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const request = async <T,>(method: string, path: string, body?: unknown): Promise<T> => {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: method === 'GET' ? {} : { 'content-type': 'application/json' },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  if (!res.ok) {
    const { code, error } = (data ?? {}) as { code?: ErrorCode; error?: string };
    throw new ApiError(res.status, code ?? null, errorText(getT(), code, error));
  }
  return data as T;
};

export const api = {
  get: <T,>(path: string) => request<T>('GET', path),
  post: <T,>(path: string, body?: unknown) => request<T>('POST', path, body),
  delete: <T,>(path: string) => request<T>('DELETE', path),
};
