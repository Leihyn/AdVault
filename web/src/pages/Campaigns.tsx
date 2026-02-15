import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Section, Button, Placeholder, Spinner, Title, Text, Chip } from '@telegram-apps/telegram-ui';
import { fetchCampaigns } from '../api/client.js';
import { CampaignCard } from '../components/CampaignCard.js';

const LANGUAGES = [
  { label: 'All', value: '' },
  { label: 'EN', value: 'en' },
  { label: 'RU', value: 'ru' },
  { label: 'ZH', value: 'zh' },
];

const CATEGORIES = [
  { label: 'All', value: '' },
  { label: 'Tech', value: 'tech' },
  { label: 'Crypto', value: 'crypto' },
  { label: 'Finance', value: 'finance' },
];

export function Campaigns() {
  const navigate = useNavigate();
  const [language, setLanguage] = useState('');
  const [category, setCategory] = useState('');

  const params: Record<string, string> = {};
  if (language) params.targetLanguage = language;
  if (category) params.targetCategory = category;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['campaigns', params],
    queryFn: () => fetchCampaigns(params),
  });

  return (
    <div>
      <div className="page-header">
        <Title level="2" weight="1">Campaigns</Title>
        <Text style={{ color: 'var(--tgui--hint_color)' }}>
          {data?.total !== undefined ? `${data.total} open briefs` : 'Advertiser briefs seeking channels'}
        </Text>
      </div>

      <div style={{ padding: '0 16px 12px' }}>
        <Button size="m" mode="bezeled" stretched onClick={() => navigate('/campaigns/new')}>
          + Create Campaign
        </Button>
      </div>

      <div className="filter-row">
        {LANGUAGES.map((l) => (
          <Chip key={l.value} mode={language === l.value ? 'elevated' : 'mono'} onClick={() => setLanguage(l.value)}>
            {l.label}
          </Chip>
        ))}
      </div>
      <div className="filter-row" style={{ marginTop: '-4px' }}>
        {CATEGORIES.map((c) => (
          <Chip key={c.value} mode={category === c.value ? 'elevated' : 'mono'} onClick={() => setCategory(c.value)}>
            {c.label}
          </Chip>
        ))}
      </div>

      {isLoading && <Placeholder><Spinner size="m" /></Placeholder>}
      {isError && (
        <Placeholder header="Failed to load campaigns" description="Check your connection and try again." />
      )}
      {data?.campaigns?.length > 0 && (
        <Section>
          {data.campaigns.map((campaign: any) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </Section>
      )}
      {!isLoading && data?.campaigns?.length === 0 && (
        <Placeholder
          header="No campaigns found"
          description="Try adjusting your filters or check back later."
        />
      )}
    </div>
  );
}
