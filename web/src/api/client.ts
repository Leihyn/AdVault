const API_BASE = '/api';

function getInitData(): string {
  return window.Telegram?.WebApp?.initData || '';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  const initData = getInitData();
  if (initData) {
    headers['x-telegram-init-data'] = initData;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }

  return res.json();
}

// --- Channels ---
export function fetchChannels(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
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
