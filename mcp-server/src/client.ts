// ============================================================
// WP-Automation Backend API Client
// Handles JWT auth + all HTTP calls to your NestJS backend
// ============================================================

export interface BackendConfig {
  baseUrl: string;    // e.g. http://localhost:3000/api/v1
  token: string;      // JWT access token from /auth/login
}

export class BackendClient {
  private baseUrl: string;
  private token: string;

  constructor(config: BackendConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.token = config.token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!res.ok) {
      const msg =
        typeof data === 'object' && data !== null && 'message' in data
          ? String((data as Record<string, unknown>).message)
          : text;
      throw new Error(`[${res.status}] ${msg}`);
    }

    // Unwrap NestJS TransformInterceptor envelope: { statusCode, success, message, data, meta }
    if (
      typeof data === 'object' &&
      data !== null &&
      'success' in data &&
      'statusCode' in data &&
      'data' in data
    ) {
      return (data as { data: T }).data;
    }

    return data as T;
  }

  get<T>(path: string) {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body: unknown) {
    return this.request<T>('POST', path, body);
  }

  patch<T>(path: string, body: unknown) {
    return this.request<T>('PATCH', path, body);
  }

  delete<T>(path: string) {
    return this.request<T>('DELETE', path);
  }
}
