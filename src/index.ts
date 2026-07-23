export interface SendMessageOptions {
  to: string;
  message: string;
  from?: string;
  channel?: 'sms' | 'whatsapp' | 'telegram';
  cascade?: boolean;
}

export interface SendBulkOptions {
  messages: Array<{ to: string; message: string; metadata?: Record<string, unknown> }>;
  from?: string;
  channel?: 'sms' | 'whatsapp' | 'telegram';
}

export interface SendOtpOptions {
  to: string;
  brand?: string;
  channel?: 'sms' | 'whatsapp' | 'telegram';
  code_length?: number;
  expiry?: number;
  template?: string;
  app_id?: string;
  otp_button_text?: string;
}

export interface CheckOtpOptions {
  session_id: string;
  code: string;
}

export interface CreateApiKeyOptions {
  name?: string;
  permissions?: string[];
  rate_limit?: number;
  ip_whitelist?: string[];
}

export interface CreateTopupOptions {
  amount_eur?: number;
  pack_id?: string;
  payment_method?: 'stripe' | 'cashplus' | 'bank_transfer';
}

export class EnvoiSMSClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://api.envoisms.ma') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async send(options: SendMessageOptions) {
    return this.request('/v1/messages', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async sendBulk(options: SendBulkOptions) {
    return this.request('/v1/messages/bulk', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async sendOtp(options: SendOtpOptions) {
    return this.request('/v1/verify/send', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async checkOtp(options: CheckOtpOptions) {
    return this.request('/v1/verify/check', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async analytics(days = 30) {
    return this.request(`/v1/analytics?days=${days}`);
  }

  async listMessages(limit = 50) {
    return this.request(`/v1/messages?limit=${limit}`);
  }

  async createApiKey(options: CreateApiKeyOptions) {
    return this.request('/v1/api-keys', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async createOptout(phone: string) {
    return this.request('/v1/optouts', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async listPaymentMethods() {
    return this.request('/v1/billing/payment-methods');
  }

  async createTopup(options: CreateTopupOptions) {
    return this.request('/v1/billing/topups', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  private async request(path: string, init: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...(init.headers || {}),
      },
    });

    const data = (await response.json()) as any;
    if (!response.ok) {
      throw new Error(data?.error?.message || `EnvoiSMS API error: status ${response.status}`);
    }
    return data;
  }
}
