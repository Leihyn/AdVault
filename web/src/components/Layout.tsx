import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/', label: 'Home' },
  { path: '/channels', label: 'Channels' },
  { path: '/campaigns', label: 'Campaigns' },
  { path: '/deals', label: 'Deals' },
  { path: '/profile', label: 'Profile' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1, padding: '16px' }}>{children}</main>
      <nav style={{
        display: 'flex',
        borderTop: '1px solid var(--tg-theme-hint-color, #ccc)',
        backgroundColor: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
      }}>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '12px 4px',
              fontSize: '12px',
              textDecoration: 'none',
              color: location.pathname === item.path
                ? 'var(--tg-theme-button-color, #3390ec)'
                : 'var(--tg-theme-hint-color, #999)',
              fontWeight: location.pathname === item.path ? 600 : 400,
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
