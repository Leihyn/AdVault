import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Title } from '@telegram-apps/telegram-ui';

export function NewAction() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="page-header">
        <Title level="2" weight="1">Create</Title>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 16px' }}>
        <button className="lane-card" style={{ flexDirection: 'row', gap: '14px', padding: '18px 16px' }} onClick={() => navigate('/register-channel')}>
          <div className="lane-card__icon" style={{ background: 'linear-gradient(135deg, #34C759, #248A3D)', width: 44, height: 44, borderRadius: 12 }}>
            <svg width="22" height="22" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div className="lane-card__title" style={{ fontSize: 15, marginTop: 0 }}>Register Channel</div>
            <div className="lane-card__desc" style={{ fontSize: 12 }}>YouTube, Instagram, or Twitter/X</div>
          </div>
        </button>

        <button className="lane-card" style={{ flexDirection: 'row', gap: '14px', padding: '18px 16px' }} onClick={() => navigate('/campaigns/new')}>
          <div className="lane-card__icon" style={{ background: 'linear-gradient(135deg, #FF9500, #FF6B00)', width: 44, height: 44, borderRadius: 12 }}>
            <svg width="22" height="22" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
            </svg>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div className="lane-card__title" style={{ fontSize: 15, marginTop: 0 }}>Create Campaign</div>
            <div className="lane-card__desc" style={{ fontSize: 12 }}>Post a brief for channel owners</div>
          </div>
        </button>

        <button className="lane-card" style={{ flexDirection: 'row', gap: '14px', padding: '18px 16px' }} onClick={() => navigate('/channels')}>
          <div className="lane-card__icon" style={{ background: 'linear-gradient(135deg, #007AFF, #5856D6)', width: 44, height: 44, borderRadius: 12 }}>
            <svg width="22" height="22" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div className="lane-card__title" style={{ fontSize: 15, marginTop: 0 }}>Browse & Book Ad</div>
            <div className="lane-card__desc" style={{ fontSize: 12 }}>Find a channel and create a deal</div>
          </div>
        </button>
      </div>
    </div>
  );
}
