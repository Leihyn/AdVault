import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Section, Cell, Button, Input, Placeholder, Spinner, Title, Text } from '@telegram-apps/telegram-ui';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { fetchMe, updateMe } from '../api/client.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { useToast } from '../hooks/useToast.js';

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Channel Owner',
  ADVERTISER: 'Advertiser',
  BOTH: 'Both',
};

export function Profile() {
  const { user: tgUser } = useTelegram();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [wallet, setWallet] = useState('');
  const [editing, setEditing] = useState(false);
  const [tonConnectUI] = useTonConnectUI();
  const tonWallet = useTonWallet();

  const { data: profile, isLoading, isError } = useQuery({
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

  // Auto-save wallet address when connected via TON Connect.
  // Guard with ref to prevent double-fire (strict mode / re-renders).
  const walletSaved = useRef(false);
  useEffect(() => {
    if (tonWallet && profile && !profile.tonWalletAddress && !walletSaved.current) {
      const address = tonWallet.account.address;
      if (address) {
        walletSaved.current = true;
        updateMutation.mutate({ tonWalletAddress: address });
        showToast('Wallet connected', 'success');
      }
    }
  }, [tonWallet, profile, updateMutation, showToast]);

  if (isLoading) return <Placeholder><Spinner size="m" /></Placeholder>;
  if (isError) return <Placeholder header="Failed to load profile" description="Check your connection and try again." />;

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
        <Cell after={<Text>{ROLE_LABELS[profile?.role] || profile?.role || '\u2014'}</Text>}>Role</Cell>
        <Cell multiline after={
          <Text style={{ fontSize: '12px', wordBreak: 'break-all' }}>
            {profile?.tonWalletAddress || 'Not set'}
          </Text>
        }>TON Wallet</Cell>
      </Section>

      <Section header="Wallet">
        {/* TON Connect button */}
        <div style={{ padding: '16px' }}>
          {tonWallet ? (
            <div style={{
              padding: '12px', borderRadius: '10px',
              background: 'var(--tgui--secondary_bg_color)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <Text weight="2" style={{ fontSize: '13px', display: 'block' }}>Connected</Text>
                <Text style={{ fontSize: '11px', color: 'var(--tgui--hint_color)', fontFamily: 'monospace' }}>
                  {tonWallet.account.address.slice(0, 8)}...{tonWallet.account.address.slice(-6)}
                </Text>
              </div>
              <Button size="s" mode="bezeled" onClick={() => tonConnectUI.disconnect()}>
                Disconnect
              </Button>
            </div>
          ) : (
            <Button
              size="l"
              stretched
              onClick={() => tonConnectUI.openModal()}
            >
              Connect TON Wallet
            </Button>
          )}
        </div>

        {/* Manual wallet address edit */}
        {!editing ? (
          <div style={{ padding: '0 16px 16px' }}>
            <Button
              size="l"
              stretched
              mode="bezeled"
              onClick={() => { setEditing(true); setWallet(profile?.tonWalletAddress || ''); }}
            >
              Edit Wallet Address Manually
            </Button>
          </div>
        ) : (
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
