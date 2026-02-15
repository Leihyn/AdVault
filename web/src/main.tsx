import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import { HashRouter } from 'react-router-dom';
import { AppRoot } from '@telegram-apps/telegram-ui';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import '@telegram-apps/telegram-ui/dist/styles.css';
import './app.css';
import App from './App.js';
import { ToastProvider } from './hooks/useToast.js';
import { getToastRef } from './toastRef.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
  mutationCache: new MutationCache({
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Something went wrong';
      getToastRef()?.(message, 'error');
    },
  }),
});

const tg = window.Telegram?.WebApp;
const appearance = tg?.colorScheme === 'dark' ? 'dark' : 'light';

const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <AppRoot appearance={appearance} platform="ios">
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <HashRouter>
              <App />
            </HashRouter>
          </ToastProvider>
        </QueryClientProvider>
      </AppRoot>
    </TonConnectUIProvider>
  </React.StrictMode>,
);
