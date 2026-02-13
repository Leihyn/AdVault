import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tabbar, FixedLayout } from '@telegram-apps/telegram-ui';
import { IconHome, IconBrowse, IconNew, IconActivity, IconProfile } from './Icons.js';
import { useBackButton } from '../hooks/useBackButton.js';

const NAV_ITEMS = [
  { path: '/', label: 'Home', Icon: IconHome },
  { path: '/channels', label: 'Browse', Icon: IconBrowse },
  { path: '/new', label: 'New', Icon: IconNew },
  { path: '/activity', label: 'Activity', Icon: IconActivity },
  { path: '/profile', label: 'Profile', Icon: IconProfile },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  useBackButton();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1, paddingBottom: '80px' }}>{children}</main>
      <FixedLayout style={{ zIndex: 100 }}>
        <Tabbar>
          {NAV_ITEMS.map((item) => (
            <Tabbar.Item
              key={item.path}
              text={item.label}
              selected={
                item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path)
              }
              onClick={() => navigate(item.path)}
            >
              <item.Icon />
            </Tabbar.Item>
          ))}
        </Tabbar>
      </FixedLayout>
    </div>
  );
}
