// ============================================================
// WP-Automation Backend API Client
// Handles JWT auth + all HTTP calls to your NestJS backend
// ============================================================
export class BackendClient {
    baseUrl;
    token;
    constructor(config) {
        this.baseUrl = config.baseUrl.replace(/\/$/, '');
        this.token = config.token;
    }
    async request(method, path, body) {
        const url = `${this.baseUrl}${path}`;
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
        };
        const res = await fetch(url, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        }
        catch {
            data = text;
        }
        if (!res.ok) {
            const msg = typeof data === 'object' && data !== null && 'message' in data
                ? String(data.message)
                : text;
            throw new Error(`[${res.status}] ${msg}`);
        }
        // Unwrap NestJS TransformInterceptor envelope: { statusCode, success, message, data, meta }
        if (typeof data === 'object' &&
            data !== null &&
            'success' in data &&
            'statusCode' in data &&
            'data' in data) {
            return data.data;
        }
        return data;
    }
    get(path) {
        return this.request('GET', path);
    }
    post(path, body) {
        return this.request('POST', path, body);
    }
    patch(path, body) {
        return this.request('PATCH', path, body);
    }
    delete(path) {
        return this.request('DELETE', path);
    }
}
