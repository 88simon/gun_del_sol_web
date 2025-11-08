'use client';

import { useEffect, useState } from 'react';
import { getTokens, TokensResponse } from '@/lib/api';
import { TokensTable } from './tokens-table';

export default function TokensPage() {
  const [data, setData] = useState<TokensResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch tokens from Flask API on the client side
    getTokens()
      .then(setData)
      .catch((err) => {
        console.error('Failed to fetch tokens:', err);
        setError(
          'Failed to load tokens. Make sure Flask is running on localhost:5001'
        );
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className='flex h-full items-center justify-center'>
        <div className='text-center'>
          <div className='text-lg font-medium'>Loading tokens...</div>
          <div className='text-muted-foreground mt-2 text-sm'>
            Fetching data from Flask backend
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className='flex h-full items-center justify-center'>
        <div className='text-center'>
          <div className='text-destructive text-lg font-medium'>Error</div>
          <div className='text-muted-foreground mt-2 text-sm'>
            {error || 'Failed to load tokens'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex h-full flex-col space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Analyzed Tokens</h1>
          <p className='text-muted-foreground'>
            View and manage your analyzed Solana tokens
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className='grid gap-4 md:grid-cols-3'>
        <div className='bg-card rounded-lg border p-6'>
          <div className='text-muted-foreground text-sm font-medium'>
            Total Tokens
          </div>
          <div className='text-3xl font-bold'>{data.total}</div>
        </div>
        <div className='bg-card rounded-lg border p-6'>
          <div className='text-muted-foreground text-sm font-medium'>
            Wallets Tracked
          </div>
          <div className='text-3xl font-bold'>{data.total_wallets}</div>
        </div>
        <div className='bg-card rounded-lg border p-6'>
          <div className='text-muted-foreground text-sm font-medium'>
            Latest Analysis
          </div>
          <div className='text-xl font-bold'>
            {data.tokens[0]
              ? new Date(
                  data.tokens[0].analysis_timestamp.replace(' ', 'T') + 'Z'
                ).toLocaleString()
              : '-'}
          </div>
        </div>
      </div>

      {/* Tokens Table */}
      <TokensTable tokens={data.tokens} />
    </div>
  );
}
