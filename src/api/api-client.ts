import {env} from '@/config/env';
import { RequestOptions } from '@/types';


function buildUrlWithParams(
    url: string,
    params?: RequestOptions['params'] 
): string {
    if (!params) return url;
    const filteredParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)
    );
    if (Object.keys(filteredParams).length === 0) return url;
    const queryString = new URLSearchParams(
        filteredParams as Record<string, string>
    ).toString();
    return `${url}?${queryString}`;
}

async function fetchApi<T>(
    url: string,
    options: RequestOptions = {}
): Promise<T> {
    
    const {
        method = 'GET',
        headers = {},
        body,
        cookies,
        params,
        cache = 'no-cache',
        next,

    } = options;

    const fullUrl = buildUrlWithParams(`${env.API_BASE_URL}${url}`, params);
    
    const response = await fetch(fullUrl, {
        method,
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...headers,
            ...(cookies ? { Cookie: cookies } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'omit',
    cache,
    next,
    });

    if (!response.ok) {
        const message = (await response.json())?.message || response.statusText;
        throw new Error(`API Error: ${message}`);
    }

    return response.json();
}

export const api ={
    get<T>(url: string, options?: RequestOptions) : Promise<T> {
        return fetchApi<T>(url, { ...options, method: 'GET' });
    },
    post<T>(url: string, body: any, options?: RequestOptions) : Promise<T> {
        return fetchApi<T>(url, { ...options, method: 'POST', body });
    },
    put<T>(url: string, body: any, options?: RequestOptions) : Promise<T> {
        return fetchApi<T>(url, { ...options, method: 'PUT', body });
    },
    delete<T>(url: string, options?: RequestOptions) : Promise<T> {
        return fetchApi<T>(url, { ...options, method: 'DELETE' });
    },
    patch<T>(url: string, body: any, options?: RequestOptions) : Promise<T> {
        return fetchApi<T>(url, { ...options, method: 'PATCH', body });
    }
};