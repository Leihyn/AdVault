import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Section, Placeholder, Spinner, Title, Text } from '@telegram-apps/telegram-ui';
import { fetchMyCampaigns } from '../api/client.js';
import { CampaignCard } from '../components/CampaignCard.js';

export function MyCampaigns() {
  const { data: campaigns, isLoading, isError } = useQuery({
    queryKey: ['my-campaigns'],
    queryFn: fetchMyCampaigns,
  });

  return (
    <div>
      <div className="page-header">
        <Title level="2" weight="1">My Campaigns</Title>
        <Text style={{ color: 'var(--tgui--hint_color)' }}>
          {campaigns?.length !== undefined ? `${campaigns.length} active` : 'Campaigns you created'}
        </Text>
      </div>
      {isLoading && (
        <Placeholder>
          <Spinner size="m" />
        </Placeholder>
      )}
      {isError && (
        <Placeholder header="Failed to load campaigns" description="Check your connection and try again." />
      )}
      {campaigns?.length > 0 && (
        <Section>
          {campaigns.map((campaign: any) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </Section>
      )}
      {!isLoading && campaigns?.length === 0 && (
        <Placeholder
          header="No campaigns yet"
          description="Create one with the bot using /createcampaign."
        />
      )}
    </div>
  );
}
