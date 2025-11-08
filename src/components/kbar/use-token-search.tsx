'use client';
import { useRegisterActions } from 'kbar';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function useTokenSearch() {
  const router = useRouter();
  const [tokens, setTokens] = useState<any[]>([]);

  // Fetch tokens on mount
  useEffect(() => {
    fetch('http://localhost:5001/analysis')
      .then((res) => res.json())
      .then((data) => setTokens(data.jobs || []))
      .catch((err) => console.error('Failed to load tokens for search:', err));
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
      // Optionally, you could navigate to a detail view if you create one
      // router.push(`/dashboard/tokens/${token.job_id}`);
    }
  }));

  useRegisterActions(tokenActions, [tokens]);
}
