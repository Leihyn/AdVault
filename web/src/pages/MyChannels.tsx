import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMyChannels } from '../api/client.js';
import { ChannelCard } from '../components/ChannelCard.js';

export function MyChannels() {
  const { data: channels, isLoading } = useQuery({
    queryKey: ['my-channels'],
    queryFn: fetchMyChannels,
  });

  return (
    <div>
      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>My Channels</h1>
      {isLoading && <p style={{ color: 'var(--tg-theme-hint-color)' }}>Loading...</p>}
      {channels?.map((channel: any) => (
        <ChannelCard key={channel.id} channel={channel} />
      ))}
      {channels?.length === 0 && (
        <p style={{ color: 'var(--tg-theme-hint-color)', textAlign: 'center', marginTop: '32px' }}>
          No channels yet. Use the bot to register a channel with /addchannel.
        </p>
      )}
    </div>
  );
}
