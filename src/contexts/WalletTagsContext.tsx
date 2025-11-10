'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface WalletTag {
  tag: string;
  is_kol: boolean;
  added_at: string;
}

interface WalletTagsCache {
  [walletAddress: string]: WalletTag[];
}

interface WalletTagsContextValue {
  tagsCache: WalletTagsCache;
  isLoading: boolean;
  refreshTags: () => Promise<void>;
}

const WalletTagsContext = createContext<WalletTagsContextValue | undefined>(
  undefined
);

interface WalletTagsProviderProps {
  children: React.ReactNode;
  walletAddresses: string[];
}

export function WalletTagsProvider({
  children,
  walletAddresses
}: WalletTagsProviderProps) {
  const [tagsCache, setTagsCache] = useState<WalletTagsCache>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchTags = async () => {
    if (!walletAddresses || walletAddresses.length === 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:5001/wallets/batch-tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ addresses: walletAddresses })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tags: ${response.statusText}`);
      }

      const data = await response.json();
      setTagsCache(data);
    } catch (error) {
      console.error('Failed to fetch batch wallet tags:', error);
      setTagsCache({});
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, [JSON.stringify(walletAddresses)]);

  // Listen for tag changes from other components
  useEffect(() => {
    const handleTagsChanged = (event: CustomEvent) => {
      const { walletAddress } = event.detail;
      // Refetch just this wallet's tags
      if (walletAddress && walletAddresses.includes(walletAddress)) {
        fetchSingleWalletTags(walletAddress);
      }
    };

    const fetchSingleWalletTags = async (address: string) => {
      try {
        const response = await fetch(
          `http://localhost:5001/wallets/${address}/tags`
        );
        if (response.ok) {
          const data = await response.json();
          setTagsCache((prev) => ({
            ...prev,
            [address]: data.tags || []
          }));
        }
      } catch (error) {
        console.error(`Failed to refresh tags for ${address}:`, error);
      }
    };

    window.addEventListener(
      'walletTagsChanged',
      handleTagsChanged as EventListener
    );

    return () => {
      window.removeEventListener(
        'walletTagsChanged',
        handleTagsChanged as EventListener
      );
    };
  }, [walletAddresses]);

  const refreshTags = async () => {
    await fetchTags();
  };

  return (
    <WalletTagsContext.Provider value={{ tagsCache, isLoading, refreshTags }}>
      {children}
    </WalletTagsContext.Provider>
  );
}

export function useWalletTags(walletAddress: string): {
  tags: WalletTag[];
  isLoading: boolean;
} {
  const context = useContext(WalletTagsContext);

  if (context === undefined) {
    throw new Error('useWalletTags must be used within a WalletTagsProvider');
  }

  return {
    tags: context.tagsCache[walletAddress] || [],
    isLoading: context.isLoading
  };
}
