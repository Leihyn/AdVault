import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Section, Cell, Placeholder, Spinner, Text } from '@telegram-apps/telegram-ui';
import { fetchPlatformStats } from '../api/client.js';
import { useTelegram } from '../hooks/useTelegram.js';

export function Home() {
  const { user } = useTelegram();
  const navigate = useNavigate();
  const { data: stats, isLoading } = useQuery({ queryKey: ['stats'], queryFn: fetchPlatformStats });

  return (
    <div>
      {/* Hero banner */}
      <div className="hero">
        <div className="hero__title">AdVault</div>
        <div className="hero__subtitle">
          {user ? `Welcome back, ${user.first_name}` : 'Trustless ads marketplace with TON escrow'}
        </div>
      </div>

      {/* Stats grid */}
      {isLoading && (
        <Placeholder><Spinner size="m" /></Placeholder>
      )}
      {stats && (
        <div className="stat-grid" style={{ marginBottom: '16px' }}>
          <div className="stat-card">
            <div className="stat-card__value">{stats.channels}</div>
            <div className="stat-card__label">Channels</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value">{stats.deals}</div>
            <div className="stat-card__label">Active Deals</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value">{stats.completedDeals}</div>
            <div className="stat-card__label">Completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value">{stats.totalVolumeTon}</div>
            <div className="stat-card__label">Volume (TON)</div>
          </div>
        </div>
      )}

      {/* Two-lane layout */}
      <div style={{ display: 'flex', gap: '8px', padding: '0 16px', marginTop: '8px' }}>
        {/* Advertise lane */}
        <button className="lane-card" onClick={() => navigate('/channels')}>
          <div className="lane-card__icon" style={{ background: 'linear-gradient(135deg, #007AFF, #5856D6)' }}>
            <svg width="24" height="24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <span className="lane-card__title">Advertise</span>
          <span className="lane-card__desc">Find channels to promote on</span>
        </button>

        {/* Earn lane */}
        <button className="lane-card" onClick={() => navigate('/register-channel')}>
          <div className="lane-card__icon" style={{ background: 'linear-gradient(135deg, #34C759, #248A3D)' }}>
            <svg width="24" height="24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <span className="lane-card__title">Earn</span>
          <span className="lane-card__desc">Monetize your audience</span>
        </button>
      </div>

      {/* Secondary actions */}
      <div style={{ display: 'flex', gap: '8px', padding: '8px 16px 0' }}>
        <button className="action-card action-card--compact" onClick={() => navigate('/campaigns')}>
          <div className="action-card__icon action-card__icon--sm" style={{ background: 'linear-gradient(135deg, #FF9500, #FF6B00)' }}>
            <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
            </svg>
          </div>
          <span className="action-card__label">Campaigns</span>
        </button>
        <button className="action-card action-card--compact" onClick={() => navigate('/activity')}>
          <div className="action-card__icon action-card__icon--sm" style={{ background: 'linear-gradient(135deg, #5AC8FA, #32ADE6)' }}>
            <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <span className="action-card__label">Activity</span>
        </button>
      </div>

      {/* How it works */}
      <Section header="How It Works" style={{ marginTop: '16px' }}>
        <Cell before={<StepCircle n={1} />} subtitle="Browse channels or post a campaign brief">
          Find a match
        </Cell>
        <Cell before={<StepCircle n={2} />} subtitle="TON funds lock in a per-deal escrow wallet">
          Lock funds
        </Cell>
        <Cell before={<StepCircle n={3} />} subtitle="Submit, review, and approve ad creative">
          Approve creative
        </Cell>
        <Cell before={<StepCircle n={4} />} subtitle="Bot auto-posts, verifies 24h, then releases funds">
          Auto-verify & pay
        </Cell>
      </Section>
    </div>
  );
}

function StepCircle({ n }: { n: number }) {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      background: 'var(--tgui--button_color)', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 14, fontWeight: 700, flexShrink: 0,
    }}>
      {n}
    </div>
  );
}
