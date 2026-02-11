import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Section, Cell, Button, Chip, Placeholder, Spinner, Title, Text } from '@telegram-apps/telegram-ui';
import { fetchChannel, fetchChannelStats, createDeal } from '../api/client.js';
import { PlatformIcon } from '../components/Icons.js';

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

  if (isLoading) return <Placeholder><Spinner size="m" /></Placeholder>;
  if (!channel) return <Placeholder header="Channel not found" description="This channel doesn't exist" />;

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
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Title level="2" weight="1">{channel.title}</Title>
          {channel.platform && channel.platform !== 'TELEGRAM' && (
            <Chip mode="mono">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <PlatformIcon platform={channel.platform} />
                {channel.platform.charAt(0) + channel.platform.slice(1).toLowerCase()}
              </span>
            </Chip>
          )}
        </div>
        {channel.username && (
          <Text style={{ color: 'var(--tgui--hint_color)' }}>@{channel.username}</Text>
        )}
        {channel.description && (
          <Text style={{ color: 'var(--tgui--hint_color)', display: 'block', marginTop: '4px' }}>
            {channel.description}
          </Text>
        )}
      </div>

      {/* Stat cards grid */}
      <div className="stat-grid stat-grid--three" style={{ marginBottom: '16px' }}>
        <div className="stat-card">
          <div className="stat-card__value">{channel.subscribers.toLocaleString()}</div>
          <div className="stat-card__label">Subscribers</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{channel.avgViews.toLocaleString()}</div>
          <div className="stat-card__label">Avg Views</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{channel.avgReach.toLocaleString()}</div>
          <div className="stat-card__label">Avg Reach</div>
        </div>
      </div>

      {stats && (
        <div className="stat-grid stat-grid--three" style={{ marginBottom: '16px' }}>
          <div className="stat-card">
            <div className="stat-card__value">{stats.totalDeals}</div>
            <div className="stat-card__label">Total Deals</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value">{stats.completedDeals}</div>
            <div className="stat-card__label">Completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value">{stats.totalRevenueTon}</div>
            <div className="stat-card__label">Revenue (TON)</div>
          </div>
        </div>
      )}

      <Section header="Ad Formats">
        {channel.adFormats.map((format: any) => (
          <Cell
            key={format.id}
            onClick={() => setSelectedFormat(format.id)}
            subtitle={format.description}
            after={<Chip mode={selectedFormat === format.id ? 'elevated' : 'mono'}>{format.priceTon} TON</Chip>}
            style={selectedFormat === format.id ? {
              backgroundColor: 'var(--tgui--secondary_bg_color)',
            } : undefined}
          >
            {format.label}
          </Cell>
        ))}
      </Section>

      {selectedFormat && (
        <div style={{ padding: '16px' }}>
          <Button
            size="l"
            stretched
            onClick={handleCreateDeal}
            loading={dealMutation.isPending}
          >
            Create Deal
          </Button>
        </div>
      )}

      {dealMutation.isError && (
        <div className="callout callout--error">
          {(dealMutation.error as Error).message}
        </div>
      )}
    </div>
  );
}
