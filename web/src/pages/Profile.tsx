import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchMe, updateMe } from '../api/client.js';
import { useTelegram } from '../hooks/useTelegram.js';

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Channel Owner',
  ADVERTISER: 'Advertiser',
  BOTH: 'Both',
};

export function Profile() {
  const { user: tgUser } = useTelegram();
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

  if (isLoading) return <p>Loading...</p>;

  return (
    <div>
      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Profile</h1>

      {profile && (
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          backgroundColor: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
        }}>
          <div style={rowStyle}>
            <span style={labelStyle}>Name</span>
            <span>{profile.firstName}</span>
          </div>
          {profile.username && (
            <div style={rowStyle}>
              <span style={labelStyle}>Username</span>
              <span>@{profile.username}</span>
            </div>
          )}
          <div style={rowStyle}>
            <span style={labelStyle}>Role</span>
            <span>{ROLE_LABELS[profile.role] || profile.role}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>TON Wallet</span>
            <span style={{ fontSize: '12px', wordBreak: 'break-all' }}>
              {profile.tonWalletAddress || 'Not set'}
            </span>
          </div>
        </div>
      )}

      <div style={{ marginTop: '16px' }}>
        {!editing ? (
          <button onClick={() => { setEditing(true); setWallet(profile?.tonWalletAddress || ''); }} style={btnStyle}>
            Edit Wallet Address
          </button>
        ) : (
          <div>
            <input
              type="text"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="Your TON wallet address"
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid var(--tg-theme-hint-color, #ccc)',
                backgroundColor: 'var(--tg-theme-bg-color, #fff)',
                color: 'var(--tg-theme-text-color, #000)',
                fontSize: '14px',
                marginBottom: '8px',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => updateMutation.mutate({ tonWalletAddress: wallet })}
                disabled={updateMutation.isPending}
                style={{ ...btnStyle, flex: 1 }}
              >
                Save
              </button>
              <button onClick={() => setEditing(false)} style={{ ...btnStyle, flex: 1, backgroundColor: 'var(--tg-theme-hint-color, #999)' }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Role switcher */}
      <div style={{ marginTop: '16px' }}>
        <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Switch Role</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['OWNER', 'ADVERTISER', 'BOTH'] as const).map((role) => (
            <button
              key={role}
              onClick={() => updateMutation.mutate({ role })}
              disabled={updateMutation.isPending || profile?.role === role}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: profile?.role === role
                  ? '2px solid var(--tg-theme-button-color, #3390ec)'
                  : '1px solid var(--tg-theme-hint-color, #ccc)',
                backgroundColor: profile?.role === role
                  ? 'var(--tg-theme-button-color, #3390ec)'
                  : 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
                color: profile?.role === role
                  ? 'var(--tg-theme-button-text-color, #fff)'
                  : 'var(--tg-theme-text-color, #000)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '6px 0',
  fontSize: '14px',
};
const labelStyle: React.CSSProperties = { color: 'var(--tg-theme-hint-color, #999)' };
const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  borderRadius: '10px',
  border: 'none',
  backgroundColor: 'var(--tg-theme-button-color, #3390ec)',
  color: 'var(--tg-theme-button-text-color, #fff)',
  fontWeight: 600,
  fontSize: '14px',
  cursor: 'pointer',
};
