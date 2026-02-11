import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Cell, Text, Chip } from '@telegram-apps/telegram-ui';

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
  const navigate = useNavigate();
  const tags = [campaign.targetLanguage?.toUpperCase(), campaign.targetCategory].filter(Boolean);

  return (
    <Cell
      onClick={() => navigate(`/campaigns/${campaign.id}`)}
      subtitle={campaign.brief}
      after={<Chip mode="mono">{campaign.budgetTon} TON</Chip>}
      description={
        [
          campaign._count ? `${campaign._count.applications} applications` : null,
          tags.length > 0 ? tags.join(' \u00B7 ') : null,
        ].filter(Boolean).join(' \u00B7 ') || undefined
      }
    >
      {campaign.title}
    </Cell>
  );
}
