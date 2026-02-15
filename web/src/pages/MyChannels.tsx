import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Section, Cell, Avatar, Chip, Button, Placeholder, Spinner, Title, Text } from '@telegram-apps/telegram-ui';
import { fetchMyChannels } from '../api/client.js';

export function MyChannels() {
  const navigate = useNavigate();
  const { data: channels, isLoading, isError } = useQuery({
    queryKey: ['my-channels'],
    queryFn: fetchMyChannels,
  });

  return (
    <div>
      <div className="page-header">
        <Title level="2" weight="1">My Channels</Title>
        <Text style={{ color: 'var(--tgui--hint_color)' }}>
          {channels?.length !== undefined ? `${channels.length} registered` : 'Channels you own'}
        </Text>
      </div>
      <div style={{ padding: '0 16px 12px' }}>
        <Button size="m" mode="bezeled" stretched onClick={() => navigate('/register-channel')}>
          + Register Channel
        </Button>
      </div>
      {isLoading && (
        <Placeholder>
          <Spinner size="m" />
        </Placeholder>
      )}
      {isError && (
        <Placeholder header="Failed to load channels" description="Check your connection and try again." />
      )}
      {channels?.length > 0 && (
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
      )}
      {!isLoading && channels?.length === 0 && (
        <Placeholder
          header="No channels yet"
          description="Register a YouTube, Instagram, or Twitter/X channel to start monetizing."
        >
          <Button size="m" onClick={() => navigate('/register-channel')}>
            Register Channel
          </Button>
        </Placeholder>
      )}
    </div>
  );
}
