import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchChannel, fetchChannelStats, createDeal } from '../api/client.js';

export function ChannelDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedFormat, setSelectedFormat] = useState<number | null>(null);

  const { data: channel, isLoading } = useQuery({
    queryKey: ['channel', id],
    queryFn: () => fetchChannel(Number(id)),
  });

  const { data: stats } = useQuery({
    queryKey: ['channel-stats', id],
    queryFn: () => fetchChannelStats(Number(id)),
  });

  const dealMutation = useMutation({
    mutationFn: createDeal,
    onSuccess: (deal) => navigate(`/deals/${deal.id}`),
  });

  if (isLoading) return <p>Loading...</p>;
  if (!channel) return <p>Channel not found</p>;

  const handleCreateDeal = () => {
    if (!selectedFormat) return;
    const format = channel.adFormats.find((f: any) => f.id === selectedFormat);
    if (!format) return;

    dealMutation.mutate({
      channelId: channel.id,
      adFormatId: format.id,
      amountTon: format.priceTon,
    });
  };

  return (
    <div>
      <h1 style={{ fontSize: '20px', fontWeight: 700 }}>
        {channel.title}
        {channel.username && (
          <span style={{ color: 'var(--tg-theme-hint-color)', fontWeight: 400, fontSize: '14px' }}>
            {' '}@{channel.username}
          </span>
        )}
      </h1>
      {channel.description && (
        <p style={{ color: 'var(--tg-theme-hint-color)', fontSize: '14px', marginTop: '4px' }}>
          {channel.description}
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '16px' }}>
        <StatBox label="Subscribers" value={channel.subscribers.toLocaleString()} />
        <StatBox label="Avg Views" value={channel.avgViews.toLocaleString()} />
        <StatBox label="Avg Reach" value={channel.avgReach.toLocaleString()} />
      </div>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '8px' }}>
          <StatBox label="Total Deals" value={stats.totalDeals} />
          <StatBox label="Completed" value={stats.completedDeals} />
          <StatBox label="Revenue" value={`${stats.totalRevenueTon} TON`} />
        </div>
      )}

      <h2 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '8px' }}>
        Ad Formats
      </h2>
      {channel.adFormats.map((format: any) => (
        <div
          key={format.id}
          onClick={() => setSelectedFormat(format.id)}
          style={{
            padding: '12px',
            marginBottom: '8px',
            borderRadius: '10px',
            backgroundColor: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
            border: selectedFormat === format.id
              ? '2px solid var(--tg-theme-button-color, #3390ec)'
              : '2px solid transparent',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontWeight: 600 }}>{format.label}</div>
          {format.description && (
            <div style={{ fontSize: '13px', color: 'var(--tg-theme-hint-color)', marginTop: '2px' }}>
              {format.description}
            </div>
          )}
          <div style={{ fontWeight: 500, color: 'var(--tg-theme-link-color, #3390ec)', marginTop: '4px' }}>
            {format.priceTon} TON
          </div>
        </div>
      ))}

      {selectedFormat && (
        <button
          onClick={handleCreateDeal}
          disabled={dealMutation.isPending}
          style={{
            width: '100%',
            padding: '14px',
            marginTop: '16px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: 'var(--tg-theme-button-color, #3390ec)',
            color: 'var(--tg-theme-button-text-color, #fff)',
            fontWeight: 600,
            fontSize: '15px',
            cursor: dealMutation.isPending ? 'wait' : 'pointer',
          }}
        >
          {dealMutation.isPending ? 'Creating Deal...' : 'Create Deal'}
        </button>
      )}
      {dealMutation.isError && (
        <p style={{ color: '#d9534f', marginTop: '8px', fontSize: '13px' }}>
          {(dealMutation.error as Error).message}
        </p>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      padding: '10px',
      borderRadius: '10px',
      backgroundColor: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '16px', fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--tg-theme-hint-color, #999)' }}>{label}</div>
    </div>
  );
}
