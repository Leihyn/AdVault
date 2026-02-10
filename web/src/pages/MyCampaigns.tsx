import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMyCampaigns } from '../api/client.js';
import { CampaignCard } from '../components/CampaignCard.js';

export function MyCampaigns() {
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['my-campaigns'],
    queryFn: fetchMyCampaigns,
  });

  return (
    <div>
      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>My Campaigns</h1>
      {isLoading && <p style={{ color: 'var(--tg-theme-hint-color)' }}>Loading...</p>}
      {campaigns?.map((campaign: any) => (
        <CampaignCard key={campaign.id} campaign={campaign} />
      ))}
      {campaigns?.length === 0 && (
        <p style={{ color: 'var(--tg-theme-hint-color)', textAlign: 'center', marginTop: '32px' }}>
          No campaigns yet. Create one with the bot using /createcampaign.
        </p>
      )}
    </div>
  );
}
