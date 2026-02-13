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

  // In dev mode, always send bypass headers as fallback
  if (import.meta.env.DEV) {
    headers['x-dev-secret'] = 'devsecret123';
    headers['x-dev-user-id'] = '6438629889';
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

export function createChannel(data: {
  platform: string;
  platformChannelId?: string;
  title: string;
  description?: string;
  username?: string;
  language?: string;
  category?: string;
}) {
  return request<any>('/channels', { method: 'POST', body: JSON.stringify(data) });
}

export function updateChannel(id: number, data: { title?: string; description?: string; language?: string; category?: string }) {
  return request<any>(`/channels/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function fetchChannelStats(id: number) {
  return request<any>(`/channels/${id}/stats`);
}

export function refreshChannelStats(id: number) {
  return request<any>(`/channels/${id}/refresh-stats`, { method: 'POST', body: '{}' });
}

export function syncChannelAdmins(id: number) {
  return request<any>(`/channels/${id}/admins/sync`, { method: 'POST', body: '{}' });
}

export function schedulePost(dealId: number, scheduledPostAt: string) {
  return request<any>(`/deals/${dealId}/schedule-post`, {
    method: 'POST',
    body: JSON.stringify({ scheduledPostAt }),
  });
}

export function addAdFormat(channelId: number, data: { formatType: string; label: string; description?: string; priceTon: number }) {
  return request<any>(`/channels/${channelId}/formats`, { method: 'POST', body: JSON.stringify(data) });
}

export function updateAdFormat(channelId: number, formatId: number, data: { label?: string; description?: string; priceTon?: number; isActive?: boolean }) {
  return request<any>(`/channels/${channelId}/formats/${formatId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteAdFormat(channelId: number, formatId: number) {
  return request<any>(`/channels/${channelId}/formats/${formatId}`, { method: 'DELETE' });
}

// --- Verification ---
export function generateVerificationToken(channelId: number) {
  return request<any>(`/channels/${channelId}/verify/token`, { method: 'POST', body: '{}' });
}

export function checkVerification(channelId: number) {
  return request<any>(`/channels/${channelId}/verify/check`, { method: 'POST', body: '{}' });
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
  return request<any>(`/deals/${id}/pay`, { method: 'POST', body: '{}' });
}

export function cancelDeal(id: number) {
  return request<any>(`/deals/${id}/cancel`, { method: 'POST', body: '{}' });
}

export function disputeDeal(id: number, reason: string) {
  return request<any>(`/deals/${id}/dispute`, { method: 'POST', body: JSON.stringify({ reason }) });
}

// --- Creatives ---
export function submitCreative(dealId: number, data: any) {
  return request<any>(`/deals/${dealId}/creative`, { method: 'POST', body: JSON.stringify(data) });
}

export function approveCreative(dealId: number) {
  return request<any>(`/deals/${dealId}/creative/approve`, { method: 'POST', body: '{}' });
}

export function requestRevision(dealId: number, notes: string) {
  return request<any>(`/deals/${dealId}/creative/revision`, { method: 'POST', body: JSON.stringify({ notes }) });
}

export function submitPostProof(dealId: number, postUrl: string) {
  return request<any>(`/deals/${dealId}/post-proof`, { method: 'POST', body: JSON.stringify({ postUrl }) });
}

export function waiveRequirement(dealId: number, reqId: number) {
  return request<any>(`/deals/${dealId}/requirements/${reqId}/waive`, { method: 'POST', body: '{}' });
}

export function confirmRequirement(dealId: number, reqId: number) {
  return request<any>(`/deals/${dealId}/requirements/${reqId}/confirm`, { method: 'POST', body: '{}' });
}

// --- Disputes ---
export function fetchDispute(dealId: number) {
  return request<any>(`/deals/${dealId}/dispute`);
}

export function openDispute(dealId: number, reason: string) {
  return request<any>(`/deals/${dealId}/dispute`, { method: 'POST', body: JSON.stringify({ reason }) });
}

export function submitDisputeEvidence(dealId: number, description: string, url?: string) {
  return request<any>(`/deals/${dealId}/dispute/evidence`, {
    method: 'POST', body: JSON.stringify({ description, url: url || undefined }),
  });
}

export function proposeResolution(dealId: number, outcome: string, splitPercent?: number) {
  return request<any>(`/deals/${dealId}/dispute/propose`, {
    method: 'POST', body: JSON.stringify({ outcome, splitPercent }),
  });
}

export function acceptProposal(dealId: number) {
  return request<any>(`/deals/${dealId}/dispute/accept`, { method: 'POST', body: '{}' });
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
