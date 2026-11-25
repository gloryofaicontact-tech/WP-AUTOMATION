export interface BackendConfig {
    baseUrl: string;
    token: string;
}
export declare class BackendClient {
    private baseUrl;
    private token;
    constructor(config: BackendConfig);
    private request;
    get<T>(path: string): Promise<T>;
    post<T>(path: string, body: unknown): Promise<T>;
    patch<T>(path: string, body: unknown): Promise<T>;
    delete<T>(path: string): Promise<T>;
}
