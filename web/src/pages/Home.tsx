import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchPlatformStats } from '../api/client.js';
import { useTelegram } from '../hooks/useTelegram.js';

export function Home() {
  const { user } = useTelegram();
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: fetchPlatformStats });

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>
        escrowBUILD
      </h1>
      <p style={{ color: 'var(--tg-theme-hint-color, #999)', marginBottom: '24px' }}>
        {user ? `Welcome, ${user.first_name}` : 'Telegram Ads Marketplace'}
      </p>

      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '24px',
        }}>
          {[
            { label: 'Channels', value: stats.channels },
            { label: 'Deals', value: stats.deals },
            { label: 'Completed', value: stats.completedDeals },
            { label: 'Volume', value: `${stats.totalVolumeTon} TON` },
          ].map((stat) => (
            <div key={stat.label} style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{stat.value}</div>
              <div style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color, #999)' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Link to="/channels" style={linkButtonStyle}>
          Browse Channels
        </Link>
        <Link to="/campaigns" style={linkButtonStyle}>
          Browse Campaigns
        </Link>
        <Link to="/deals" style={linkButtonStyle}>
          My Deals
        </Link>
      </div>
    </div>
  );
}

const linkButtonStyle: React.CSSProperties = {
  display: 'block',
  padding: '14px',
  borderRadius: '12px',
  backgroundColor: 'var(--tg-theme-button-color, #3390ec)',
  color: 'var(--tg-theme-button-text-color, #fff)',
  textDecoration: 'none',
  textAlign: 'center',
  fontWeight: 600,
  fontSize: '15px',
};
