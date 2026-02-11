import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Cell, Avatar, Text, Chip } from '@telegram-apps/telegram-ui';
import { PlatformIcon } from './Icons.js';

interface Props {
  channel: {
    id: number;
    title: string;
    username?: string;
    subscribers: number;
    avgViews: number;
    language?: string;
    category?: string;
    platform?: string;
    adFormats: { label: string; priceTon: number }[];
  };
}

export function ChannelCard({ channel }: Props) {
  const navigate = useNavigate();
  const minPrice = channel.adFormats.length > 0
    ? Math.min(...channel.adFormats.map((f) => f.priceTon))
    : null;

  const platform = channel.platform || 'TELEGRAM';
  const descParts = [];
  if (platform !== 'TELEGRAM') descParts.push(platform.charAt(0) + platform.slice(1).toLowerCase());
  if (channel.language) descParts.push(channel.language.toUpperCase());
  if (channel.category) descParts.push(channel.category);

  return (
    <Cell
      onClick={() => navigate(`/channels/${channel.id}`)}
      before={
        <div style={{ position: 'relative' }}>
          <Avatar size={48} acronym={channel.title.charAt(0)} />
          {platform !== 'TELEGRAM' && (
            <div style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--tgui--bg_color)', borderRadius: '50%', padding: 2 }}>
              <PlatformIcon platform={platform} />
            </div>
          )}
        </div>
      }
      subtitle={`${channel.subscribers.toLocaleString()} subs \u00B7 ${channel.avgViews.toLocaleString()} avg views`}
      after={minPrice !== null ? <Chip mode="mono">{minPrice} TON</Chip> : undefined}
      description={descParts.join(' \u00B7 ') || undefined}
    >
      {channel.title}
    </Cell>
  );
}
