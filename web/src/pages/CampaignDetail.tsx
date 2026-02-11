import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Section, Cell, Button, Placeholder, Spinner, Title, Text, Chip, Textarea } from '@telegram-apps/telegram-ui';
import { fetchCampaign, applyToCampaign } from '../api/client.js';

export function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [proposedPrice, setProposedPrice] = useState('');

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => fetchCampaign(Number(id)),
  });

  const applyMutation = useMutation({
    mutationFn: () => applyToCampaign(Number(id), {
      message: message || undefined,
      proposedPriceTon: proposedPrice ? Number(proposedPrice) : undefined,
    }),
    onSuccess: () => navigate('/deals'),
  });

  if (isLoading) return <Placeholder><Spinner size="m" /></Placeholder>;
  if (!campaign) return <Placeholder header="Campaign not found" />;

  return (
    <div>
      <div className="page-header">
        <Title level="2" weight="1">{campaign.title}</Title>
        {campaign.advertiser && (
          <Text style={{ color: 'var(--tgui--hint_color)' }}>
            by {campaign.advertiser.firstName || campaign.advertiser.username || 'Advertiser'}
          </Text>
        )}
      </div>

      <Section header="Brief">
        <Cell multiline>
          <Text style={{ whiteSpace: 'pre-wrap' }}>{campaign.brief}</Text>
        </Cell>
      </Section>

      <Section header="Details">
        <Cell after={<Text weight="1" style={{ color: 'var(--tgui--link_color)' }}>{campaign.budgetTon} TON</Text>}>Budget</Cell>
        {campaign.targetLanguage && (
          <Cell after={<Chip mode="mono">{campaign.targetLanguage.toUpperCase()}</Chip>}>Language</Cell>
        )}
        {campaign.targetCategory && (
          <Cell after={<Chip mode="mono">{campaign.targetCategory}</Chip>}>Category</Cell>
        )}
        {campaign.minSubscribers && (
          <Cell after={<Text>{campaign.minSubscribers.toLocaleString()}+</Text>}>Min Subscribers</Cell>
        )}
        {campaign._count?.applications !== undefined && (
          <Cell after={<Text>{campaign._count.applications}</Text>}>Applications</Cell>
        )}
      </Section>

      <Section header="Apply with Your Channel">
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Textarea
            header="Message (optional)"
            placeholder="Why your channel is a good fit..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
          />
          <div>
            <Text style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px', display: 'block' }}>
              Proposed Price (TON)
            </Text>
            <input
              type="number"
              step="0.1"
              min="0"
              placeholder={String(campaign.budgetTon)}
              value={proposedPrice}
              onChange={(e) => setProposedPrice(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                border: '1px solid var(--tgui--outline)',
                background: 'var(--tgui--bg_color)', color: 'var(--tgui--text_color)',
                fontSize: '16px', boxSizing: 'border-box',
              }}
            />
          </div>
          <Button
            size="l"
            stretched
            onClick={() => applyMutation.mutate()}
            loading={applyMutation.isPending}
          >
            Submit Application
          </Button>
          {applyMutation.isError && (
            <div className="callout callout--error">
              {(applyMutation.error as Error).message}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
