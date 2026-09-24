import { HttpErrorResponse } from '@angular/common/http';
import { ProblemDetail } from '../api/models';

function isProblem(value: unknown): value is ProblemDetail {
  return typeof value === 'object' && value !== null && !(value instanceof Blob);
}

function parseProblem(body: unknown): ProblemDetail | null {
  if (isProblem(body)) {
    return body;
  }
  if (typeof body === 'string' && body.trim().startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(body);
      return isProblem(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Extracts an RFC 7807 problem from an HTTP error, if the server sent one. */
export function problemOf(error: unknown): ProblemDetail | null {
  return error instanceof HttpErrorResponse ? parseProblem(error.error) : null;
}

/** Field → message map from a 400 validation failure. */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  return problemOf(error)?.errors ?? {};
}

const STATUS_FALLBACKS: Record<number, string> = {
  0: 'Cannot reach the server. Check your connection and try again.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You are not allowed to perform this action.',
  404: 'The requested resource was not found.',
  409: 'The request conflicts with the current state. Please refresh and try again.',
  423: 'This account is temporarily locked. Please try again later.',
};

/** Human-readable message for any error, preferring the server's `detail`. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof HttpErrorResponse) {
    const problem = problemOf(error);
    if (problem?.detail) {
      return problem.detail;
    }
    const errors = problem?.errors ? Object.values(problem.errors) : [];
    if (errors.length) {
      return errors.join(' ');
    }
    if (error.status >= 500) {
      return 'The server encountered an error. Please try again shortly.';
    }
    return STATUS_FALLBACKS[error.status] ?? problem?.title ?? fallback;
  }
  return fallback;
}

/**
 * Like {@link errorMessage} but also understands problem bodies delivered as a Blob
 * (requests made with `responseType: 'blob'`, e.g. CSV statements).
 */
export async function errorMessageAsync(error: unknown, fallback?: string): Promise<string> {
  if (error instanceof HttpErrorResponse && error.error instanceof Blob) {
    try {
      const text = await error.error.text();
      const problem = parseProblem(text);
      if (problem?.detail) {
        return problem.detail;
      }
    } catch {
      /* fall through */
    }
    return errorMessage(new HttpErrorResponse({ status: error.status, statusText: error.statusText }), fallback);
  }
  return errorMessage(error, fallback);
}
