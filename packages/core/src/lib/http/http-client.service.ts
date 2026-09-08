import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { TransactionContext } from '../logger/context/transaction-context';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class HttpClientService {
    constructor(
        private readonly httpService: HttpService,
        private readonly transactionContext: TransactionContext,
    ) {
        this.httpService.axiosRef.interceptors.request.use((config) => {
            Object.assign(config.headers, this.transactionContext.getPropagationHeaders());
            return config;
        });
    }

    get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
        return this.request<T>({ ...config, url, method: 'GET' });
    }

    post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
        return this.request<T>({ ...config, url, method: 'POST', data });
    }

    put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
        return this.request<T>({ ...config, url, method: 'PUT', data });
    }

    patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
        return this.request<T>({ ...config, url, method: 'PATCH', data });
    }

    delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
        return this.request<T>({ ...config, url, method: 'DELETE' });
    }

    /** Like the verb helpers above, but resolves with the full response (status + headers) instead of just the body. */
    raw<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return firstValueFrom(this.httpService.request<T>(config));
    }

    private async request<T>(config: AxiosRequestConfig): Promise<T> {
        const response = await this.raw<T>(config);
        return response.data;
    }
}
