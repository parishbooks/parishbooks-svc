import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { e2eConfig } from './e2e-config';
import { HttpSnapshot, snapshotResponse } from './snapshot';

export const api: AxiosInstance = axios.create({
    baseURL: e2eConfig.baseUrl,
    validateStatus: () => true,
    headers: { 'Content-Type': 'application/json' },
});

export async function requestSnapshot(config: AxiosRequestConfig): Promise<HttpSnapshot> {
    const res = await api.request(config);
    return snapshotResponse(res.status, res.data);
}

export function authHeaders(token: string): AxiosRequestConfig {
    return { headers: { Authorization: `Bearer ${token}` } };
}

export function internalHeaders(): AxiosRequestConfig {
    return { headers: { 'x-internal-service-key': e2eConfig.internalServiceKey } };
}
