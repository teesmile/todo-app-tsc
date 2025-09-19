export interface RequestOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    cookies?: string;
    params?: Record<string, string | number | boolean | undefined | null>;
    cache?: RequestCache;
    next?: NextFetchRequestConfig;
} 

export interface FetchResult <T> {
    data: T | null;
    error: string | null;
    status: number | null;
    loading: boolean;
}

