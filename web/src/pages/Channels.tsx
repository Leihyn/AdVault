import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Section, Placeholder, Spinner, Title, Text, Chip } from '@telegram-apps/telegram-ui';
import { fetchChannels } from '../api/client.js';
import { ChannelCard } from '../components/ChannelCard.js';
import { IconTelegram, IconYouTube, IconInstagram, IconTwitter } from '../components/Icons.js';

const PLATFORMS = [
  { label: 'All', value: '', icon: null },
  { label: 'Telegram', value: 'TELEGRAM', icon: <IconTelegram /> },
  { label: 'YouTube', value: 'YOUTUBE', icon: <IconYouTube /> },
  { label: 'Instagram', value: 'INSTAGRAM', icon: <IconInstagram /> },
  { label: 'Twitter/X', value: 'TWITTER', icon: <IconTwitter /> },
];

const LANGUAGES = [
  { label: 'All', value: '' },
  { label: 'EN', value: 'en' },
  { label: 'RU', value: 'ru' },
  { label: 'ZH', value: 'zh' },
  { label: 'ES', value: 'es' },
];

const CATEGORIES = [
  { label: 'All', value: '' },
  { label: 'Tech', value: 'tech' },
  { label: 'Crypto', value: 'crypto' },
  { label: 'Finance', value: 'finance' },
  { label: 'Entertainment', value: 'entertainment' },
  { label: 'News', value: 'news' },
];

export function Channels() {
  const [platform, setPlatform] = useState('');
  const [language, setLanguage] = useState('');
  const [category, setCategory] = useState('');

  const params: Record<string, string> = {};
  if (platform) params.platform = platform;
  if (language) params.language = language;
  if (category) params.category = category;

  const { data, isLoading } = useQuery({
    queryKey: ['channels', params],
    queryFn: () => fetchChannels(params),
  });

  return (
    <div>
      <div className="page-header">
        <Title level="2" weight="1">Channels</Title>
        <Text style={{ color: 'var(--tgui--hint_color)' }}>
          {data?.total !== undefined ? `${data.total} available` : 'Browse ad placements'}
        </Text>
      </div>

      {/* Platform filter */}
      <div className="filter-row">
        {PLATFORMS.map((p) => (
          <Chip
            key={p.value}
            mode={platform === p.value ? 'elevated' : 'mono'}
            onClick={() => setPlatform(p.value)}
          >
            {p.icon && <span style={{ marginRight: 4, display: 'inline-flex', verticalAlign: 'middle' }}>{p.icon}</span>}
            {p.label}
          </Chip>
        ))}
      </div>

      {/* Language filter */}
      <div className="filter-row" style={{ marginTop: '-4px' }}>
        {LANGUAGES.map((l) => (
          <Chip
            key={l.value}
            mode={language === l.value ? 'elevated' : 'mono'}
            onClick={() => setLanguage(l.value)}
          >
            {l.label}
          </Chip>
        ))}
      </div>
      <div className="filter-row" style={{ marginTop: '-4px' }}>
        {CATEGORIES.map((c) => (
          <Chip
            key={c.value}
            mode={category === c.value ? 'elevated' : 'mono'}
            onClick={() => setCategory(c.value)}
          >
            {c.label}
          </Chip>
        ))}
      </div>

      {isLoading && (
        <Placeholder><Spinner size="m" /></Placeholder>
      )}
      {data?.channels?.length > 0 && (
        <Section>
          {data.channels.map((channel: any) => (
            <ChannelCard key={channel.id} channel={channel} />
          ))}
        </Section>
      )}
      {!isLoading && data?.channels?.length === 0 && (
        <Placeholder
          header="No channels found"
          description="Try adjusting your filters or check back later."
        />
      )}
    </div>
  );
}
