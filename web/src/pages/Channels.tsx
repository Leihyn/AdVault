import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchChannels } from '../api/client.js';
import { ChannelCard } from '../components/ChannelCard.js';
import { FilterBar } from '../components/FilterBar.js';

const FILTERS = [
  {
    key: 'language',
    label: 'Language',
    options: [
      { label: 'English', value: 'en' },
      { label: 'Russian', value: 'ru' },
      { label: 'Chinese', value: 'zh' },
      { label: 'Spanish', value: 'es' },
    ],
  },
  {
    key: 'category',
    label: 'Category',
    options: [
      { label: 'Tech', value: 'tech' },
      { label: 'Crypto', value: 'crypto' },
      { label: 'Finance', value: 'finance' },
      { label: 'Entertainment', value: 'entertainment' },
      { label: 'News', value: 'news' },
    ],
  },
];

export function Channels() {
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const params: Record<string, string> = {};
  if (filterValues.language) params.language = filterValues.language;
  if (filterValues.category) params.category = filterValues.category;

  const { data, isLoading } = useQuery({
    queryKey: ['channels', params],
    queryFn: () => fetchChannels(params),
  });

  return (
    <div>
      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>Channels</h1>
      <FilterBar
        filters={FILTERS}
        values={filterValues}
        onChange={(key, value) => setFilterValues((prev) => ({ ...prev, [key]: value }))}
      />
      {isLoading && <p style={{ color: 'var(--tg-theme-hint-color)' }}>Loading...</p>}
      {data?.channels?.map((channel: any) => (
        <ChannelCard key={channel.id} channel={channel} />
      ))}
      {data?.channels?.length === 0 && (
        <p style={{ color: 'var(--tg-theme-hint-color)', textAlign: 'center', marginTop: '32px' }}>
          No channels found
        </p>
      )}
    </div>
  );
}
