import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCampaigns } from '../api/client.js';
import { CampaignCard } from '../components/CampaignCard.js';
import { FilterBar } from '../components/FilterBar.js';

const FILTERS = [
  {
    key: 'targetLanguage',
    label: 'Language',
    options: [
      { label: 'English', value: 'en' },
      { label: 'Russian', value: 'ru' },
      { label: 'Chinese', value: 'zh' },
    ],
  },
  {
    key: 'targetCategory',
    label: 'Category',
    options: [
      { label: 'Tech', value: 'tech' },
      { label: 'Crypto', value: 'crypto' },
      { label: 'Finance', value: 'finance' },
    ],
  },
];

export function Campaigns() {
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const params: Record<string, string> = {};
  if (filterValues.targetLanguage) params.targetLanguage = filterValues.targetLanguage;
  if (filterValues.targetCategory) params.targetCategory = filterValues.targetCategory;

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', params],
    queryFn: () => fetchCampaigns(params),
  });

  return (
    <div>
      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>Campaigns</h1>
      <FilterBar
        filters={FILTERS}
        values={filterValues}
        onChange={(key, value) => setFilterValues((prev) => ({ ...prev, [key]: value }))}
      />
      {isLoading && <p style={{ color: 'var(--tg-theme-hint-color)' }}>Loading...</p>}
      {data?.campaigns?.map((campaign: any) => (
        <CampaignCard key={campaign.id} campaign={campaign} />
      ))}
      {data?.campaigns?.length === 0 && (
        <p style={{ color: 'var(--tg-theme-hint-color)', textAlign: 'center', marginTop: '32px' }}>
          No campaigns found
        </p>
      )}
    </div>
  );
}
