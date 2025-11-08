'use client';
import { useRegisterActions } from 'kbar';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function useTokenSearch() {
  const router = useRouter();
  const [tokens, setTokens] = useState<any[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  // Fetch tokens and tags on mount
  useEffect(() => {
    // Fetch tokens
    fetch('http://localhost:5001/analysis')
      .then((res) => res.json())
      .then((data) => setTokens(data.jobs || []))
      .catch((err) => console.error('Failed to load tokens for search:', err));

    // Fetch tags
    fetch('http://localhost:5001/tags')
      .then((res) => res.json())
      .then((data) => setTags(data.tags || []))
      .catch((err) => console.error('Failed to load tags for search:', err));
  }, []);

  // Register token actions dynamically
  const tokenActions = tokens.map((token) => ({
    id: `token-${token.job_id}`,
    name: `${token.token_name || 'Unknown'} (${token.token_symbol || '-'})`,
    keywords: [
      token.token_name,
      token.token_symbol,
      token.acronym,
      token.token_address
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
    section: 'Tokens',
    subtitle: `${token.acronym} • ${token.wallets_found} wallets`,
    perform: () => {
      router.push(`/dashboard/tokens`);
    }
  }));

  // Register tag actions dynamically - fetch wallets for each tag
  const [tagWallets, setTagWallets] = useState<Record<string, string[]>>({});

  useEffect(() => {
    // Fetch wallets for each tag
    if (tags.length > 0) {
      Promise.all(
        tags.map((tag) =>
          fetch(`http://localhost:5001/tags/${encodeURIComponent(tag)}/wallets`)
            .then((res) => res.json())
            .then((data) => ({ tag, wallets: data.wallets || [] }))
        )
      )
        .then((results) => {
          const walletsMap: Record<string, string[]> = {};
          results.forEach(({ tag, wallets }) => {
            walletsMap[tag] = wallets;
          });
          setTagWallets(walletsMap);
        })
        .catch((err) =>
          console.error('Failed to load wallets for tags:', err)
        );
    }
  }, [tags]);

  // Create actions for each wallet under each tag
  const walletActions: any[] = [];
  Object.entries(tagWallets).forEach(([tag, wallets]) => {
    wallets.forEach((walletAddress) => {
      walletActions.push({
        id: `wallet-${tag}-${walletAddress}`,
        name: walletAddress,
        keywords: `${tag} ${walletAddress}`,
        section: `Tag: ${tag}`,
        subtitle: `Wallet with tag "${tag}"`,
        perform: () => {
          // Copy wallet address to clipboard
          navigator.clipboard.writeText(walletAddress);
          // Optionally navigate to tokens page
          router.push(`/dashboard/tokens`);
        }
      });
    });
  });

  useRegisterActions([...tokenActions, ...walletActions], [
    tokens,
    tagWallets
  ]);
}
