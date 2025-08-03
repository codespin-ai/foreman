/**
 * HTTP client utilities
 */

import { Result, success, failure } from './result.js';

export type HttpRequestOptions = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
};

/**
 * Make an HTTP request with error handling
 */
export async function httpRequest<T>(
  options: HttpRequestOptions
): Promise<Result<T, Error>> {
  try {
    const controller = new AbortController();
    const timeoutId = options.timeout 
      ? setTimeout(() => controller.abort(), options.timeout)
      : null;

    const response = await fetch(options.url, {
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const data = await response.json();

    if (!response.ok) {
      const errorData = data as { error?: string; message?: string };
      const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
      return failure(new Error(errorMessage));
    }

    return success(data as T);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return failure(new Error('Request timeout'));
      }
      return failure(error);
    }
    return failure(new Error('Unknown error'));
  }
}

/**
 * Build query string from parameters
 */
export function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    
    if (Array.isArray(value)) {
      // Join arrays with commas
      searchParams.append(key, value.join(','));
    } else if (typeof value === 'object') {
      searchParams.append(key, JSON.stringify(value));
    } else {
      searchParams.append(key, String(value));
    }
  }
  
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}