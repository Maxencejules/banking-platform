import { HttpParams } from '@angular/common/http';
import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Base URL of the REST API, without a trailing slash (e.g. `/api`). */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiBaseUrl.replace(/\/+$/, ''),
});

type ParamValue = string | number | boolean | null | undefined;

/**
 * Builds query parameters, skipping `null`, `undefined` and blank strings so optional
 * filters are simply omitted from the URL.
 */
export function toHttpParams(values: Record<string, ParamValue>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) {
      continue;
    }
    const text = typeof value === 'string' ? value.trim() : String(value);
    if (text !== '') {
      params = params.set(key, text);
    }
  }
  return params;
}
