import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Section, Cell, Placeholder, Spinner, Title, Text, Chip } from '@telegram-apps/telegram-ui';
import { fetchDeals } from '../api/client.js';
import { DealStatusBadge } from '../components/DealStatus.js';

const ROLE_FILTERS = [
  { label: 'All', value: '' },
  { label: 'As Advertiser', value: 'advertiser' },
  { label: 'As Owner', value: 'owner' },
];

export function Deals() {
  const navigate = useNavigate();
  const [roleFilter, setRoleFilter] = useState('');

  const params: Record<string, string> = {};
  if (roleFilter) params.role = roleFilter;

  const { data: deals, isLoading } = useQuery({
    queryKey: ['deals', params],
    queryFn: () => fetchDeals(params),
  });

  return (
    <div>
      <div className="page-header">
        <Title level="2" weight="1">My Deals</Title>
      </div>

      <div className="filter-row">
        {ROLE_FILTERS.map((f) => (
          <Chip key={f.value} mode={roleFilter === f.value ? 'elevated' : 'mono'} onClick={() => setRoleFilter(f.value)}>
            {f.label}
          </Chip>
        ))}
      </div>

      {isLoading && <Placeholder><Spinner size="m" /></Placeholder>}

      {deals?.length > 0 && (
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
      )}

      {!isLoading && deals?.length === 0 && (
        <Placeholder
          header="No deals yet"
          description="Browse channels to create your first deal, or apply to a campaign."
        />
      )}
    </div>
  );
}
