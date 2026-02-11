const API_BASE = '/api';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 15000;

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getInitData(): string {
  return window.Telegram?.WebApp?.initData || '';
}

/** Delay helper */
function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Retryable request with timeout and exponential backoff */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  const initData = getInitData();
  if (initData) {
    headers['x-telegram-init-data'] = initData;
  }

  // DEV ONLY: bypass Telegram auth for local testing
  if (!initData && import.meta.env.DEV) {
    headers['x-dev-secret'] = 'devsecret123';
    headers['x-dev-user-id'] = '1';
  }

  const isIdempotent = !options.method || options.method === 'GET';
  const retries = isIdempotent ? MAX_RETRIES : 0;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: res.statusText }));
        throw new ApiError(
          body.message || `Request failed: ${res.status}`,
          res.status,
          body.error,
        );
      }

      return res.json();
    } catch (error) {
      clearTimeout(timeout);
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry client errors (4xx) — only network/server errors
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        throw error;
      }

      if (attempt < retries) {
        await delay(RETRY_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }

  throw lastError || new Error('Request failed');
}

// --- Channels ---
export function fetchChannels(params?: Record<string, string>) {
  const filtered = params ? Object.fromEntries(Object.entries(params).filter(([, v]) => v)) : undefined;
  const qs = filtered && Object.keys(filtered).length ? '?' + new URLSearchParams(filtered).toString() : '';
  return request<any>(`/channels${qs}`);
}

export function fetchChannel(id: number) {
  return request<any>(`/channels/${id}`);
}

export function fetchChannelStats(id: number) {
  return request<any>(`/channels/${id}/stats`);
}

// --- Campaigns ---
export function fetchCampaigns(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request<any>(`/campaigns${qs}`);
}

export function fetchCampaign(id: number) {
  return request<any>(`/campaigns/${id}`);
}

export function createCampaign(data: any) {
  return request<any>('/campaigns', { method: 'POST', body: JSON.stringify(data) });
}

export function applyToCampaign(campaignId: number, data: any) {
  return request<any>(`/campaigns/${campaignId}/apply`, { method: 'POST', body: JSON.stringify(data) });
}

// --- Deals ---
export function fetchDeals(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request<any>(`/deals${qs}`);
}

export function fetchDeal(id: number) {
  return request<any>(`/deals/${id}`);
}

export function createDeal(data: any) {
  return request<any>('/deals', { method: 'POST', body: JSON.stringify(data) });
}

export function payDeal(id: number) {
  return request<any>(`/deals/${id}/pay`, { method: 'POST' });
}

export function cancelDeal(id: number) {
  return request<any>(`/deals/${id}/cancel`, { method: 'POST' });
}

export function disputeDeal(id: number, reason: string) {
  return request<any>(`/deals/${id}/dispute`, { method: 'POST', body: JSON.stringify({ reason }) });
}

// --- Creatives ---
export function submitCreative(dealId: number, data: any) {
  return request<any>(`/deals/${dealId}/creative`, { method: 'POST', body: JSON.stringify(data) });
}

export function approveCreative(dealId: number) {
  return request<any>(`/deals/${dealId}/creative/approve`, { method: 'POST' });
}

export function requestRevision(dealId: number, notes: string) {
  return request<any>(`/deals/${dealId}/creative/revision`, { method: 'POST', body: JSON.stringify({ notes }) });
}

export function schedulePost(dealId: number, scheduledPostAt: string) {
  return request<any>(`/deals/${dealId}/creative/schedule`, { method: 'POST', body: JSON.stringify({ scheduledPostAt }) });
}

export function fetchCreatives(dealId: number) {
  return request<any>(`/deals/${dealId}/creatives`);
}

// --- Users ---
export function fetchMe() {
  return request<any>('/users/me');
}

export function updateMe(data: any) {
  return request<any>('/users/me', { method: 'PUT', body: JSON.stringify(data) });
}

export function fetchMyChannels() {
  return request<any>('/users/me/channels');
}

export function fetchMyCampaigns() {
  return request<any>('/users/me/campaigns');
}

// --- Stats ---
export function fetchPlatformStats() {
  return request<any>('/stats');
}
