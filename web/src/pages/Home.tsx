import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Section, Cell, Button, Placeholder, Spinner, Text } from '@telegram-apps/telegram-ui';
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
        <div className="hero__title">escrowBUILD</div>
        <div className="hero__subtitle">
          {user ? `Welcome back, ${user.first_name}` : 'Trustless Telegram Ads Marketplace'}
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

      {/* Quick actions */}
      <div className="action-grid">
        <button className="action-card" onClick={() => navigate('/channels')}>
          <div className="action-card__icon" style={{ background: 'linear-gradient(135deg, #007AFF, #5856D6)' }}>
            <svg width="22" height="22" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <span className="action-card__label">Browse Channels</span>
        </button>
        <button className="action-card" onClick={() => navigate('/campaigns')}>
          <div className="action-card__icon" style={{ background: 'linear-gradient(135deg, #FF9500, #FF6B00)' }}>
            <svg width="22" height="22" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
            </svg>
          </div>
          <span className="action-card__label">Campaigns</span>
        </button>
        <button className="action-card" onClick={() => navigate('/deals')}>
          <div className="action-card__icon" style={{ background: 'linear-gradient(135deg, #34C759, #248A3D)' }}>
            <svg width="22" height="22" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><path d="M16 8l-5.2 6.4L8 11.4" />
            </svg>
          </div>
          <span className="action-card__label">My Deals</span>
        </button>
        <button className="action-card" onClick={() => navigate('/profile')}>
          <div className="action-card__icon" style={{ background: 'linear-gradient(135deg, #AF52DE, #8944AB)' }}>
            <svg width="22" height="22" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <span className="action-card__label">Profile</span>
        </button>
      </div>

      {/* How it works */}
      <Section header="How It Works" style={{ marginTop: '8px' }}>
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
