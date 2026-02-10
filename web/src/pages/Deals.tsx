import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchDeals } from '../api/client.js';
import { DealStatusBadge } from '../components/DealStatus.js';

export function Deals() {
  const { data: deals, isLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: () => fetchDeals(),
  });

  return (
    <div>
      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>My Deals</h1>
      {isLoading && <p style={{ color: 'var(--tg-theme-hint-color)' }}>Loading...</p>}
      {deals?.map((deal: any) => (
        <Link
          key={deal.id}
          to={`/deals/${deal.id}`}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>Deal #{deal.id}</span>
            <DealStatusBadge status={deal.status} />
          </div>
          <div style={{ fontSize: '14px', marginTop: '4px' }}>
            {deal.channel?.title}
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '13px', color: 'var(--tg-theme-hint-color)' }}>
            <span>{deal.adFormat?.label}</span>
            <span>{deal.amountTon} TON</span>
          </div>
        </Link>
      ))}
      {deals?.length === 0 && (
        <p style={{ color: 'var(--tg-theme-hint-color)', textAlign: 'center', marginTop: '32px' }}>
          No deals yet. Browse channels to create your first deal.
        </p>
      )}
    </div>
  );
}
