'use client';

import { ReactNode, useEffect } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { AuthProvider } from '../contexts/AuthContext';

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

export default function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    const anyWindow = window as unknown as {
      ethereum?: {
        providers?: Array<{
          on?: unknown;
          off?: unknown;
          addListener?: unknown;
          removeListener?: unknown;
        }>;
        on?: unknown;
        off?: unknown;
        addListener?: unknown;
        removeListener?: unknown;
      };
    };

    const normalizeProvider = (provider?: {
      on?: unknown;
      off?: unknown;
      addListener?: unknown;
      removeListener?: unknown;
    }) => {
      if (!provider) return;

      // Some injected providers don't implement `.on`/`.off` but do expose add/remove listener APIs.
      if (typeof provider.on !== 'function' && typeof provider.addListener === 'function') {
        provider.on = provider.addListener;
      }
      if (typeof provider.off !== 'function' && typeof provider.removeListener === 'function') {
        provider.off = provider.removeListener;
      }

      // Last-resort: provide no-op handlers so SDKs expecting `.on` don't crash.
      if (typeof provider.on !== 'function') {
        provider.on = () => undefined;
      }
      if (typeof provider.off !== 'function') {
        provider.off = () => undefined;
      }
    };

    const eth = anyWindow.ethereum;
    if (!eth) return;
    normalizeProvider(eth);
    eth.providers?.forEach(normalizeProvider);
  }, []);

  if (!privyAppId) {
    console.warn('Privy App ID is not set; authentication will not function.');
    return <AuthProvider>{children}</AuthProvider>;
  }

  if (!walletConnectProjectId) {
    console.warn('WalletConnect Project ID is not set; wallet connections may be limited.');
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ['email', 'wallet'],
        walletConnectCloudProjectId: walletConnectProjectId,
        externalWallets: {
          walletConnect: {
            enabled: true,
          },
        },
        embeddedWallets: { createOnLogin: 'users-without-wallets' },
      }}
    >
      <AuthProvider>{children}</AuthProvider>
    </PrivyProvider>
  );
}
