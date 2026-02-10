import React from 'react';
import { Link } from 'react-router-dom';

interface Props {
  campaign: {
    id: number;
    title: string;
    brief: string;
    budgetTon: number;
    targetLanguage?: string;
    targetCategory?: string;
    _count?: { applications: number };
    advertiser?: { firstName?: string; username?: string };
  };
}

export function CampaignCard({ campaign }: Props) {
  return (
    <Link
      to={`/campaigns/${campaign.id}`}
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
      <div style={{ fontWeight: 600, fontSize: '16px' }}>{campaign.title}</div>
      <div style={{
        marginTop: '4px',
        fontSize: '13px',
        color: 'var(--tg-theme-hint-color, #999)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {campaign.brief}
      </div>
      <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '13px' }}>
        <span style={{ fontWeight: 500, color: 'var(--tg-theme-link-color, #3390ec)' }}>
          {campaign.budgetTon} TON
        </span>
        {campaign._count && (
          <span style={{ color: 'var(--tg-theme-hint-color, #999)' }}>
            {campaign._count.applications} applications
          </span>
        )}
      </div>
    </Link>
  );
}
