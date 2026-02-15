import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Shows the Telegram BackButton on sub-pages and hides it on root tabs.
 * Falls back to browser history.back() outside of Telegram.
 */
const ROOT_PATHS = ['/', '/channels', '/campaigns', '/deals', '/new', '/activity', '/profile'];

export function useBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const isRoot = ROOT_PATHS.includes(location.pathname);

  useEffect(() => {
    const bb = window.Telegram?.WebApp?.BackButton;
    if (!bb) return;

    if (isRoot) {
      bb.hide();
      return;
    }

    const handler = () => navigate(-1);
    bb.show();
    bb.onClick(handler);
    return () => {
      bb.offClick(handler);
      bb.hide();
    };
  }, [isRoot, navigate]);
}
