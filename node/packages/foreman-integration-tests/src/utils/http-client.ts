import fetch, { RequestInit } from 'node-fetch';

export class HttpClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string, options?: { headers?: Record<string, string> }) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = options?.headers || {};
  }

  async request<T = any>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...this.defaultHeaders,
        ...options?.headers
      }
    });

    const text = await response.text();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    // Try to parse as JSON, otherwise return text
    try {
      return JSON.parse(text);
    } catch {
      return text as any;
    }
  }

  async get<T = any>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  async post<T = any>(path: string, body?: any): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    });
  }

  async put<T = any>(path: string, body?: any): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined
    });
  }

  async delete<T = any>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}