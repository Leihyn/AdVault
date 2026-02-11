import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Section, Cell, Button, Input, Placeholder, Spinner, Title, Text } from '@telegram-apps/telegram-ui';
import { fetchMe, updateMe } from '../api/client.js';
import { useTelegram } from '../hooks/useTelegram.js';

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Channel Owner',
  ADVERTISER: 'Advertiser',
  BOTH: 'Both',
};

export function Profile() {
  const { user: tgUser } = useTelegram();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [wallet, setWallet] = useState('');
  const [editing, setEditing] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: !!tgUser,
  });

  const updateMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setEditing(false);
    },
  });

  if (isLoading) return <Placeholder><Spinner size="m" /></Placeholder>;

  const initial = profile?.firstName?.charAt(0)?.toUpperCase() || '?';

  return (
    <div>
      {/* Avatar header */}
      <div className="profile-header">
        <div className="profile-header__avatar">{initial}</div>
        <Title level="2" weight="1">{profile?.firstName || 'User'}</Title>
        {profile?.username && (
          <Text style={{ color: 'var(--tgui--hint_color)' }}>@{profile.username}</Text>
        )}
      </div>

      <Section header="Account">
        <Cell after={<Text>{ROLE_LABELS[profile?.role] || profile?.role || '—'}</Text>}>Role</Cell>
        <Cell multiline after={
          <Text style={{ fontSize: '12px', wordBreak: 'break-all' }}>
            {profile?.tonWalletAddress || 'Not set'}
          </Text>
        }>TON Wallet</Cell>
      </Section>

      <Section header="Wallet">
        {!editing ? (
          <div style={{ padding: '16px' }}>
            <Button
              size="l"
              stretched
              mode="bezeled"
              onClick={() => { setEditing(true); setWallet(profile?.tonWalletAddress || ''); }}
            >
              Edit Wallet Address
            </Button>
          </div>
        ) : (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Input
              placeholder="Your TON wallet address"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                size="m"
                stretched
                onClick={() => updateMutation.mutate({ tonWalletAddress: wallet })}
                loading={updateMutation.isPending}
              >
                Save
              </Button>
              <Button size="m" stretched mode="gray" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Section>

      <Section header="Switch Role">
        <div style={{ display: 'flex', gap: '8px', padding: '16px' }}>
          {(['OWNER', 'ADVERTISER', 'BOTH'] as const).map((role) => (
            <Button
              key={role}
              size="m"
              stretched
              mode={profile?.role === role ? 'filled' : 'outline'}
              onClick={() => updateMutation.mutate({ role })}
              disabled={updateMutation.isPending || profile?.role === role}
            >
              {ROLE_LABELS[role]}
            </Button>
          ))}
        </div>
      </Section>

      <Section header="My Content">
        <Cell onClick={() => navigate('/my-channels')} after={<ChevronRight />}>
          My Channels
        </Cell>
        <Cell onClick={() => navigate('/my-campaigns')} after={<ChevronRight />}>
          My Campaigns
        </Cell>
        <Cell onClick={() => navigate('/deals')} after={<ChevronRight />}>
          My Deals
        </Cell>
      </Section>
    </div>
  );
}

function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--tgui--hint_color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
