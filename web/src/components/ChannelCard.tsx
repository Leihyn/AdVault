import React from 'react';
import { Link } from 'react-router-dom';

interface Props {
  channel: {
    id: number;
    title: string;
    username?: string;
    subscribers: number;
    avgViews: number;
    language?: string;
    category?: string;
    adFormats: { label: string; priceTon: number }[];
  };
}

export function ChannelCard({ channel }: Props) {
  const minPrice = channel.adFormats.length > 0
    ? Math.min(...channel.adFormats.map((f) => f.priceTon))
    : null;

  return (
    <Link
      to={`/channels/${channel.id}`}
      style={{
        display: 'block',
        padding: '12px',
        marginBottom: '8px',
        borderRadius: '12px',
        backgroundColor: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
        textDecoration: 'none',
        color: 'var(--tg-theme-text-color, #000)',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '16px' }}>
        {channel.title}
        {channel.username && (
          <span style={{ color: 'var(--tg-theme-hint-color, #999)', fontWeight: 400, fontSize: '14px' }}>
            {' '}@{channel.username}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '13px', color: 'var(--tg-theme-hint-color, #999)' }}>
        <span>{channel.subscribers.toLocaleString()} subs</span>
        <span>{channel.avgViews.toLocaleString()} avg views</span>
        {channel.language && <span>{channel.language.toUpperCase()}</span>}
      </div>
      {minPrice !== null && (
        <div style={{ marginTop: '6px', fontSize: '14px', fontWeight: 500, color: 'var(--tg-theme-link-color, #3390ec)' }}>
          From {minPrice} TON
        </div>
      )}
    </Link>
  );
}
