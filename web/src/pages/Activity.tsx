import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Section, Cell, Avatar, Chip, Button, Placeholder, Spinner, Title, Text } from '@telegram-apps/telegram-ui';
import { fetchMyChannels, fetchDeals, fetchMyCampaigns } from '../api/client.js';
import { DealStatusBadge } from '../components/DealStatus.js';
import { CampaignCard } from '../components/CampaignCard.js';

const TABS = [
  { label: 'Deals', value: 'deals' },
  { label: 'Channels', value: 'channels' },
  { label: 'Campaigns', value: 'campaigns' },
];

function DealsTab() {
  const navigate = useNavigate();
  const { data: deals, isLoading } = useQuery({
    queryKey: ['deals', {}],
    queryFn: () => fetchDeals(),
  });

  if (isLoading) return <Placeholder><Spinner size="m" /></Placeholder>;

  if (!deals?.length) {
    return (
      <Placeholder
        header="No deals yet"
        description="Browse channels to create your first deal."
      >
        <Button size="m" onClick={() => navigate('/channels')}>
          Browse Channels
        </Button>
      </Placeholder>
    );
  }

  return (
    <Section>
      {deals.map((deal: any) => (
        <Cell
          key={deal.id}
          onClick={() => navigate(`/deals/${deal.id}`)}
          subtitle={`${deal.adFormat?.label || 'Ad'} \u00B7 ${deal.amountTon} TON`}
          after={<DealStatusBadge status={deal.status} />}
          description={deal.channel?.title}
        >
          Deal #{deal.id}
        </Cell>
      ))}
    </Section>
  );
}

function ChannelsTab() {
  const navigate = useNavigate();
  const { data: channels, isLoading } = useQuery({
    queryKey: ['my-channels'],
    queryFn: fetchMyChannels,
  });

  if (isLoading) return <Placeholder><Spinner size="m" /></Placeholder>;

  return (
    <div>
      <div style={{ padding: '0 16px 12px' }}>
        <Button size="m" mode="bezeled" stretched onClick={() => navigate('/register-channel')}>
          + Register Channel
        </Button>
      </div>
      {channels?.length > 0 ? (
        <Section>
          {channels.map((channel: any) => {
            const activeFormats = channel.adFormats?.filter((f: any) => f.isActive) || [];
            const draftFormats = channel.adFormats?.filter((f: any) => !f.isActive) || [];
            const hasNoPricing = activeFormats.length === 0;
            return (
              <Cell
                key={channel.id}
                onClick={() => navigate(`/my-channels/${channel.id}`)}
                before={<Avatar size={48} acronym={channel.title.charAt(0)} />}
                subtitle={
                  <span>
                    {channel.subscribers?.toLocaleString() || 0} subs
                    {' \u00B7 '}
                    {activeFormats.length} live format{activeFormats.length !== 1 ? 's' : ''}
                    {draftFormats.length > 0 && `, ${draftFormats.length} draft`}
                  </span>
                }
                after={
                  hasNoPricing ? (
                    <Chip mode="elevated" style={{ color: 'var(--tgui--destructive_text_color)', fontSize: '11px' }}>
                      Set prices
                    </Chip>
                  ) : (
                    <Chip mode="mono">Manage</Chip>
                  )
                }
              >
                {channel.title}
              </Cell>
            );
          })}
        </Section>
      ) : (
        <Placeholder
          header="No channels yet"
          description="Register a channel to start earning from ads."
        >
          <Button size="m" onClick={() => navigate('/register-channel')}>
            Register Channel
          </Button>
        </Placeholder>
      )}
    </div>
  );
}

function CampaignsTab() {
  const navigate = useNavigate();
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['my-campaigns'],
    queryFn: fetchMyCampaigns,
  });

  if (isLoading) return <Placeholder><Spinner size="m" /></Placeholder>;

  if (!campaigns?.length) {
    return (
      <Placeholder
        header="No campaigns yet"
        description="Create a campaign to find channels for your ads."
      >
        <Button size="m" onClick={() => navigate('/campaigns')}>
          Browse Campaigns
        </Button>
      </Placeholder>
    );
  }

  return (
    <Section>
      {campaigns.map((campaign: any) => (
        <CampaignCard key={campaign.id} campaign={campaign} />
      ))}
    </Section>
  );
}

export function Activity() {
  const [tab, setTab] = useState('deals');

  return (
    <div>
      <div className="page-header">
        <Title level="2" weight="1">Activity</Title>
      </div>

      <div className="filter-row">
        {TABS.map((t) => (
          <Chip
            key={t.value}
            mode={tab === t.value ? 'elevated' : 'mono'}
            onClick={() => setTab(t.value)}
            style={{ cursor: 'pointer' }}
          >
            {t.label}
          </Chip>
        ))}
      </div>

      {tab === 'deals' && <DealsTab />}
      {tab === 'channels' && <ChannelsTab />}
      {tab === 'campaigns' && <CampaignsTab />}
    </div>
  );
}
