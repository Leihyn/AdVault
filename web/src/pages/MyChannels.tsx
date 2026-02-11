import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Section, Placeholder, Spinner, Title, Text } from '@telegram-apps/telegram-ui';
import { fetchMyChannels } from '../api/client.js';
import { ChannelCard } from '../components/ChannelCard.js';

export function MyChannels() {
  const { data: channels, isLoading } = useQuery({
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
      {isLoading && (
        <Placeholder>
          <Spinner size="m" />
        </Placeholder>
      )}
      {channels?.length > 0 && (
        <Section>
          {channels.map((channel: any) => (
            <ChannelCard key={channel.id} channel={channel} />
          ))}
        </Section>
      )}
      {!isLoading && channels?.length === 0 && (
        <Placeholder
          header="No channels yet"
          description="Use the bot to register a channel with /addchannel."
        />
      )}
    </div>
  );
}
