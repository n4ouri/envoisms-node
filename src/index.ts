import { createHmac, timingSafeEqual } from 'crypto';

export interface EnvoiSMSConfig {
  apiKey: string;
  baseUrl?: string;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface SendMessageOptions {
  to: string;
  message: string;
  from?: string;
  channel?: 'sms' | 'whatsapp' | 'rcs';
  cascade?: boolean;
  metadata?: Record<string, unknown>;
}

export interface SendBulkOptions {
  messages: Array<{ to: string; message: string; metadata?: Record<string, unknown> }>;
  from?: string;
  channel?: 'sms' | 'whatsapp';
}

export interface SendOtpOptions {
  to: string;
  channel?: 'sms' | 'whatsapp' | 'voice' | 'rcs';
  brand?: string;
  code_length?: 4 | 6 | 8;
  expiry?: number;
  app_id?: string;
}

export interface CreateApiKeyOptions {
  name?: string;
  permissions?: string[];
  rate_limit?: number;
  ip_whitelist?: string[];
}

export interface CreateTopupOptions {
  amount_eur?: number;
  amount_mad?: number;
  pack_id?: string;
  payment_method?: 'stripe' | 'crypto';
}

export interface WebhookEvent<T = Record<string, unknown>> {
  event: string;
  timestamp: string;
  data: T;
}

export class EnvoiSMSError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'EnvoiSMSError';
  }
}

export class EnvoiSMSClient {
  private apiKey: string;
  private baseUrl: string;
  private maxRetries: number;
  private timeoutMs: number;

  constructor(config: string | EnvoiSMSConfig) {
    if (typeof config === 'string') {
      this.apiKey = config;
      this.baseUrl = 'https://api.envoisms.ma';
      this.maxRetries = 2;
      this.timeoutMs = 15000;
    } else {
      this.apiKey = config.apiKey;
      this.baseUrl = (config.baseUrl || 'https://api.envoisms.ma').replace(/\/$/, '');
      this.maxRetries = config.maxRetries ?? 2;
      this.timeoutMs = config.timeoutMs ?? 15000;
    }
  }

  // --- Messages ---
  async send(input: SendMessageOptions) {
    return this.request<{
      message_id: string;
      status: string;
      to: string;
      channel: string;
      parts: number;
      cost_mad?: number;
      cost_eur?: number;
    }>('/v1/messages', { method: 'POST', body: JSON.stringify(input) });
  }

  async sendBulk(input: SendBulkOptions) {
    return this.request<{
      batch_id: string;
      total: number;
      queued: number;
      failed: number;
    }>('/v1/messages/bulk', { method: 'POST', body: JSON.stringify(input) });
  }

  async getMessage(messageId: string) {
    return this.request<{
      id: string;
      to: string;
      status: 'pending' | 'sent' | 'delivered' | 'failed' | 'rejected';
      channel: string;
      created_at: string;
      delivered_at?: string;
      failure_reason?: string;
    }>(`/v1/messages/${encodeURIComponent(messageId)}`);
  }

  async listMessages(limit = 50, offset = 0) {
    return this.request<{
      messages: Array<Record<string, unknown>>;
      total: number;
      limit: number;
      offset: number;
    }>(`/v1/messages?limit=${limit}&offset=${offset}`);
  }

  // --- Verify / OTP ---
  async sendOtp(input: SendOtpOptions) {
    return this.request<{
      session_id: string;
      message_id: string;
      to: string;
      channel: string;
      status: string;
      expires_at: string;
    }>('/v1/verify/send', { method: 'POST', body: JSON.stringify(input) });
  }

  async checkOtp(input: { session_id: string; code: string }) {
    return this.request<{
      session_id: string;
      verified: boolean;
      status: string;
      verified_at?: string;
    }>('/v1/verify/check', { method: 'POST', body: JSON.stringify(input) });
  }

  async getOtpSession(sessionId: string) {
    return this.request<{
      id: string;
      to: string;
      status: 'pending' | 'verified' | 'failed' | 'expired' | 'voided';
      channel: string;
      attempts: number;
      created_at: string;
      expires_at: string;
    }>(`/v1/verify/${encodeURIComponent(sessionId)}`);
  }

  // --- Account & Billing ---
  async getBalance() {
    return this.request<{
      balance_mad: number;
      balance_eur: number;
      currency: string;
      plan: string;
    }>('/v1/billing/balance');
  }

  async listPacks() {
    return this.request<{
      packs: Array<{ id: string; name: string; sms_count: number; price_mad: number; price_eur: number }>;
    }>('/v1/billing/packs');
  }

  async listPaymentMethods() {
    return this.request('/v1/billing/payment-methods');
  }

  async createTopup(input: CreateTopupOptions) {
    return this.request('/v1/billing/topups', { method: 'POST', body: JSON.stringify(input) });
  }

  // --- Analytics & API Keys ---
  async analytics(days = 30) {
    return this.request(`/v1/analytics?days=${days}`);
  }

  async createApiKey(input: CreateApiKeyOptions) {
    return this.request('/v1/api-keys', { method: 'POST', body: JSON.stringify(input) });
  }

  // --- Compliance ---
  async createOptout(phone: string) {
    return this.request('/v1/optouts', { method: 'POST', body: JSON.stringify({ phone }) });
  }

  // --- Webhook Signature Verification ---
  static verifyWebhookSignature(
    rawBody: string,
    signatureHeader: string,
    secret: string,
    toleranceSeconds = 300
  ): boolean {
    if (!rawBody || !signatureHeader || !secret) return false;

    // Handles timestamped scheme: t=1234567890,v1=abcdef...
    if (signatureHeader.includes('t=') && signatureHeader.includes('v1=')) {
      const parts = Object.fromEntries(
        signatureHeader.split(',').map((p) => p.trim().split('='))
      );
      const timestamp = parseInt(parts.t, 10);
      const signature = parts.v1;

      if (!timestamp || !signature) return false;
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestamp) > toleranceSeconds) return false;

      const expected = createHmac('sha256', secret)
        .update(`${timestamp}.${rawBody}`)
        .digest('hex');

      try {
        return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
      } catch {
        return false;
      }
    }

    // Handles direct sha256=... header
    const cleanSignature = signatureHeader.replace(/^sha256=/, '');
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(cleanSignature, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  }

  // --- Internal Request Helper with Retries ---
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(`${this.baseUrl}${path}`, {
          ...init,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            'User-Agent': 'EnvoiSMS-NodeSDK/1.1.0',
            ...(init.headers || {}),
          },
        });

        clearTimeout(timeout);

        if (response.status >= 500 && attempt < this.maxRetries) {
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 500));
          continue;
        }

        const data = await response.json();
        if (!response.ok) {
          throw new EnvoiSMSError(
            data?.error?.message || `EnvoiSMS API error (${response.status})`,
            response.status,
            data?.error?.code,
            data?.error?.details
          );
        }

        return data as T;
      } catch (err: any) {
        lastError = err;
        if (err?.name === 'AbortError') {
          lastError = new EnvoiSMSError(`Request timeout after ${this.timeoutMs}ms`, 408);
        }
        if (attempt < this.maxRetries && (err?.name === 'AbortError' || err?.message?.includes('fetch failed'))) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 500));
          continue;
        }
        break;
      }
    }

    throw lastError || new EnvoiSMSError('Request failed');
  }
}
