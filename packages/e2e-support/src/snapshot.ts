const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/;
const JWT_RE = /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/;

export function sanitizeValue(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map(sanitizeValue);
    if (typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [key, nested] of Object.entries(value as Record<string, unknown>)) out[key] = sanitizeValue(nested);
        return out;
    }
    if (typeof value !== 'string') return value;

    if (UUID_RE.test(value)) return '<uuid>';
    if (ISO_DATETIME_RE.test(value)) return '<iso-datetime>';
    if (JWT_RE.test(value)) return '<jwt>';
    if (keyLooksLikeSecret(value)) return '<secret>';
    if (value.includes('googleusercontent.com') || value.startsWith('http://') || value.startsWith('https://')) return sanitizeUrl(value);
    if (value.includes('@') && value.includes('.')) return '<email>';
    return value;
}

function keyLooksLikeSecret(value: string): boolean {
    return value.length >= 32 && !value.includes(' ');
}

function sanitizeUrl(value: string): string {
    try {
        const url = new URL(value);
        url.searchParams.forEach((_, key) => url.searchParams.set(key, '<param>'));
        if (url.pathname.includes('/')) url.pathname = url.pathname.replace(/[0-9a-f-]{36}/gi, '<uuid>');
        return url.toString();
    } catch {
        return value;
    }
}

export type HttpSnapshot = {
    status: number;
    data: unknown;
    headers?: Record<string, string>;
};

export function snapshotResponse(status: number, data: unknown, headers?: Record<string, string>): HttpSnapshot {
    const payload: HttpSnapshot = { status, data: sanitizeValue(data) };
    if (headers) payload.headers = sanitizeValue(headers) as Record<string, string>;
    return payload;
}
