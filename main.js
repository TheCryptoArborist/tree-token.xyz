import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  ConnectButton,
  SuiClientProvider,
  WalletProvider,
  useCurrentAccount,
} from '@mysten/dapp-kit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getFullnodeUrl } from '@mysten/sui/client';
import '@mysten/dapp-kit/dist/index.css';

const queryClient = new QueryClient();
const networks = {
  mainnet: { url: getFullnodeUrl('mainnet') },
};

function WalletStatus() {
  const account = useCurrentAccount();

  return React.createElement(
    'div',
    {
      style: {
        marginTop: '18px',
        padding: '16px',
        borderRadius: '14px',
        background: '#111827',
        border: '1px solid #233046',
        color: '#e5eefb',
      },
    },
    account
      ? [
          React.createElement('div', { key: 'label', style: { color: '#9fb0c5', marginBottom: '8px' } }, 'Connected account'),
          React.createElement('div', { key: 'addr', style: { fontFamily: 'monospace', wordBreak: 'break-all' } }, account.address),
        ]
      : React.createElement('div', { style: { color: '#9fb0c5' } }, 'No wallet connected')
  );
}

function App() {
  return React.createElement(
    'div',
    {
      style: {
        minHeight: '100vh',
        background: 'radial-gradient(circle at top, #102032, #081018 55%)',
        color: '#e5eefb',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        fontFamily: 'Inter, system-ui, Arial, sans-serif',
      },
    },
    React.createElement(
      'div',
      {
        style: {
          width: 'min(720px, 100%)',
          background: 'rgba(15, 23, 35, 0.96)',
          border: '1px solid #233046',
          borderRadius: '20px',
          padding: '28px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        },
      },
      React.createElement('h1', { style: { margin: '0 0 10px', fontSize: '2rem' } }, 'TREE x Slush Connect'),
      React.createElement(
        'p',
        { style: { margin: '0 0 18px', color: '#9fb0c5', lineHeight: 1.6 } },
        'This uses Mysten dApp Kit and the official ConnectButton. If Slush is installed, it should appear in the wallet modal automatically.'
      ),
      React.createElement(ConnectButton, null),
      React.createElement(WalletStatus, null)
    )
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(
    React.StrictMode,
    null,
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        SuiClientProvider,
        { networks, defaultNetwork: 'mainnet' },
        React.createElement(
          WalletProvider,
          {
            autoConnect: true,
          },
          React.createElement(App, null)
        )
      )
    )
  )
);
