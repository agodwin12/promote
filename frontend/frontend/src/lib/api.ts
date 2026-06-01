import axios, {
    AxiosError,
    AxiosInstance,
    AxiosRequestConfig,
    InternalAxiosRequestConfig,
} from 'axios';
import {
    ApiResponse,
    Company,
    CompanyWithBuses,
    BusWithLocation,
    Bus,
} from './types';

// ─────────────────────────────────────────
// BASE URL
// ─────────────────────────────────────────
const BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// ─────────────────────────────────────────
// AXIOS INSTANCE
// Single instance shared across all calls.
// ─────────────────────────────────────────
const http: AxiosInstance = axios.create({
    baseURL:        `${BASE_URL}/api`,
    timeout:        10000,
    headers: {
        'Content-Type': 'application/json',
        Accept:         'application/json',
    },
    withCredentials: true,
});

// ─────────────────────────────────────────
// REQUEST INTERCEPTOR
// Attach request metadata for debugging.
// ─────────────────────────────────────────
http.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        config.metadata = { startTime: Date.now() };
        return config;
    },
    (error) => Promise.reject(error)
);

// ─────────────────────────────────────────
// RESPONSE INTERCEPTOR
// Normalises errors into a consistent shape
// so every call site gets the same error format.
// ─────────────────────────────────────────
http.interceptors.response.use(
    (response) => {
        const duration = Date.now() - (response.config as any).metadata?.startTime;
        if (process.env.NODE_ENV === 'development') {
            console.debug(
                `[API] ${response.config.method?.toUpperCase()} ${response.config.url} → ${response.status} (${duration}ms)`
            );
        }
        return response;
    },
    (error: AxiosError<ApiResponse<unknown>>) => {
        const duration = Date.now() - (error.config as any)?.metadata?.startTime;
        const status   = error.response?.status;
        const message  =
            error.response?.data?.error ||
            error.message ||
            'An unexpected error occurred';

        if (process.env.NODE_ENV === 'development') {
            console.error(
                `[API] ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${status ?? 'ERR'} (${duration}ms): ${message}`
            );
        }

        // Rethrow a normalised error object
        const normalised = new ApiError(message, status, error.response?.data);
        return Promise.reject(normalised);
    }
);

// ─────────────────────────────────────────
// API ERROR CLASS
// Thrown by every failed API call so catch
// blocks always get a typed, predictable error.
// ─────────────────────────────────────────
export class ApiError extends Error {
    public readonly statusCode: number | undefined;
    public readonly data:       unknown;

    constructor(message: string, statusCode?: number, data?: unknown) {
        super(message);
        this.name       = 'ApiError';
        this.statusCode = statusCode;
        this.data       = data;
    }

    get isNotFound()     { return this.statusCode === 404; }
    get isConflict()     { return this.statusCode === 409; }
    get isServerError()  { return (this.statusCode ?? 0) >= 500; }
    get isNetworkError() { return !this.statusCode; }
}

// ─────────────────────────────────────────
// RETRY HELPER
// Retries a request up to `maxRetries` times
// with exponential backoff. Only retries on
// network errors or 5xx responses — never on
// 4xx (those are client mistakes, not transient).
// ─────────────────────────────────────────
async function withRetry<T>(
    fn:          () => Promise<T>,
    maxRetries:  number = 2,
    baseDelayMs: number = 300,
): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            const isRetryable =
                error instanceof ApiError &&
                (error.isNetworkError || error.isServerError);

            if (!isRetryable || attempt === maxRetries) break;

            const delay = baseDelayMs * Math.pow(2, attempt);
            await new Promise((r) => setTimeout(r, delay));
        }
    }

    throw lastError;
}

// ─────────────────────────────────────────
// UNWRAP HELPER
// All backend responses are { success, data }.
// This unwraps the data field so callers get
// the payload directly.
// ─────────────────────────────────────────
async function unwrap<T>(
    config: AxiosRequestConfig
): Promise<T> {
    const response = await http.request<ApiResponse<T>>(config);
    return response.data.data;
}

// ─────────────────────────────────────────
// COMPANIES API
// ─────────────────────────────────────────
export const companiesApi = {

    /**
     * Fetch all companies for the dashboard card grid.
     * Retries up to 2x on network/server errors.
     */
    getAll: (): Promise<Company[]> =>
        withRetry(() =>
            unwrap<Company[]>({ method: 'GET', url: '/companies' })
        ),

    /**
     * Fetch a single company with its bus list.
     */
    getOne: (id: number): Promise<CompanyWithBuses> =>
        withRetry(() =>
            unwrap<CompanyWithBuses>({ method: 'GET', url: `/companies/${id}` })
        ),

    /**
     * Fetch all buses for a company with their latest GPS position.
     * Called on tracking page load to seed the map before
     * Socket.IO updates start arriving.
     */
    getBuses: (id: number): Promise<BusWithLocation[]> =>
        withRetry(() =>
            unwrap<BusWithLocation[]>({ method: 'GET', url: `/companies/${id}/buses` })
        ),

    /**
     * Create a new company with a logo.
     * @param formData - multipart/form-data with `name`, `slug?`, `logo`
     */
    create: (formData: FormData): Promise<Company> =>
        unwrap<Company>({
            method:  'POST',
            url:     '/companies',
            data:    formData,
            headers: { 'Content-Type': 'multipart/form-data' },
        }),

    /**
     * Update a company. Logo is optional.
     */
    update: (id: number, formData: FormData): Promise<Company> =>
        unwrap<Company>({
            method:  'PUT',
            url:     `/companies/${id}`,
            data:    formData,
            headers: { 'Content-Type': 'multipart/form-data' },
        }),

    /**
     * Delete a company and all its buses + location history.
     */
    remove: (id: number): Promise<{ message: string }> =>
        unwrap<{ message: string }>({
            method: 'DELETE',
            url:    `/companies/${id}`,
        }),
};

// ─────────────────────────────────────────
// BUSES API
// ─────────────────────────────────────────
export const busesApi = {

    /**
     * Fetch all buses across all companies.
     */
    getAll: (): Promise<Bus[]> =>
        withRetry(() =>
            unwrap<Bus[]>({ method: 'GET', url: '/buses' })
        ),

    /**
     * Fetch a single bus with its company info and latest location.
     */
    getOne: (id: number): Promise<BusWithLocation> =>
        withRetry(() =>
            unwrap<BusWithLocation>({ method: 'GET', url: `/buses/${id}` })
        ),

    /**
     * Get the latest GPS position for a single bus.
     * Redis → DB fallback on the backend.
     */
    getLocation: (id: number): Promise<BusWithLocation['location']> =>
        withRetry(() =>
            unwrap<BusWithLocation['location']>({
                method: 'GET',
                url:    `/buses/${id}/location`,
            })
        ),

    /**
     * Register a new bus under a company.
     */
    create: (data: {
        company_id: number;
        plate:      string;
        model?:     string;
        mac_id:     string;
    }): Promise<Bus> =>
        unwrap<Bus>({
            method: 'POST',
            url:    '/buses',
            data,
        }),

    /**
     * Update bus details.
     */
    update: (id: number, data: Partial<{
        company_id: number;
        plate:      string;
        model:      string;
        mac_id:     string;
    }>): Promise<Bus> =>
        unwrap<Bus>({
            method: 'PUT',
            url:    `/buses/${id}`,
            data,
        }),

    /**
     * Delete a bus and all its location history.
     */
    remove: (id: number): Promise<{ message: string }> =>
        unwrap<{ message: string }>({
            method: 'DELETE',
            url:    `/buses/${id}`,
        }),
};

// ─────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────
export const healthApi = {
    check: (): Promise<{
        status:    string;
        env:       string;
        timestamp: string;
        uptime:    number;
    }> =>
        axios
            .get(`${BASE_URL}/health`, { timeout: 5000 })
            .then((r) => r.data),
};

export default http;