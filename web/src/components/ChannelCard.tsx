import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Cell, Avatar, Chip } from '@telegram-apps/telegram-ui';
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
    isVerified?: boolean;
    adFormats: { label: string; priceTon: number; formatType?: string }[];
  };
}

export function ChannelCard({ channel }: Props) {
  const navigate = useNavigate();
  const minPrice = channel.adFormats.length > 0
    ? Math.min(...channel.adFormats.map((f) => f.priceTon))
    : null;

  const platform = channel.platform || 'TELEGRAM';

  const formatLabels = channel.adFormats.slice(0, 3).map((f) => f.label);
  const extraCount = channel.adFormats.length - 3;

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
      subtitle={
        <span>
          {channel.subscribers.toLocaleString()} subs {'\u00B7'} {channel.avgViews.toLocaleString()} avg views
          {formatLabels.length > 0 && (
            <>
              <br />
              <span style={{ color: 'var(--tgui--hint_color)', fontSize: '12px' }}>
                {formatLabels.join(', ')}{extraCount > 0 ? ` +${extraCount}` : ''}
              </span>
            </>
          )}
        </span>
      }
      after={minPrice !== null ? (
        <div style={{ textAlign: 'right' }}>
          <Chip mode="mono">{minPrice} TON</Chip>
        </div>
      ) : (
        <span style={{ fontSize: '11px', color: 'var(--tgui--hint_color)' }}>No pricing</span>
      )}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {channel.title}
        {channel.isVerified && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--tgui--link_color)" style={{ flexShrink: 0 }}>
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        )}
      </span>
    </Cell>
  );
}
