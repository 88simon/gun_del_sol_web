'use client';

import { useEffect, useState } from 'react';
import {
  getTokens,
  getMultiTokenWallets,
  TokensResponse,
  MultiTokenWalletsResponse
} from '@/lib/api';
import { TokensTable } from './tokens-table';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { WalletTags } from '@/components/wallet-tags';

export default function TokensPage() {
  const [data, setData] = useState<TokensResponse | null>(null);
  const [multiWallets, setMultiWallets] =
    useState<MultiTokenWalletsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch tokens and multi-token wallets from Flask API
    Promise.all([getTokens(), getMultiTokenWallets(2)])
      .then(([tokensData, walletsData]) => {
        setData(tokensData);
        setMultiWallets(walletsData);
      })
      .catch((err) => {
        console.error('Failed to fetch data:', err);
        setError(
          'Failed to load data. Make sure Flask is running on localhost:5001'
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
      <div className='grid gap-4 md:grid-cols-4'>
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
            Multi-Token Wallets
          </div>
          <div className='text-3xl font-bold'>
            {multiWallets?.total || 0}
          </div>
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

      {/* Multi-Token Wallets Section */}
      {multiWallets && multiWallets.total > 0 && (
        <div className='bg-card rounded-lg border p-6'>
          <h2 className='mb-2 text-xl font-bold'>Multi-Token Wallets</h2>
          <p className='text-muted-foreground mb-4 text-sm'>
            Wallets that appear in multiple analyzed tokens (potential
            whale/insider wallets)
          </p>
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead>
                <tr className='border-b'>
                  <th className='pb-3 text-left font-medium'>Wallet Address</th>
                  <th className='pb-3 text-left font-medium'>Tags</th>
                  <th className='pb-3 text-center font-medium'>Tokens</th>
                  <th className='pb-3 text-left font-medium'>Token Names</th>
                </tr>
              </thead>
              <tbody>
                {multiWallets.wallets.map((wallet) => (
                  <tr key={wallet.wallet_address} className='border-b'>
                    <td className='py-3 font-mono'>
                      <div className='flex items-center gap-2'>
                        <a
                          href={`https://solscan.io/account/${wallet.wallet_address}`}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-primary hover:underline'
                        >
                          {wallet.wallet_address.substring(0, 8)}...
                          {wallet.wallet_address.substring(
                            wallet.wallet_address.length - 6
                          )}
                        </a>
                        <Button
                          variant='ghost'
                          size='sm'
                          className='h-6 w-6 p-0'
                          onClick={() => {
                            navigator.clipboard.writeText(
                              wallet.wallet_address
                            );
                            toast.success('Address copied to clipboard');
                          }}
                        >
                          <Copy className='h-3 w-3' />
                        </Button>
                      </div>
                    </td>
                    <td className='py-3'>
                      <WalletTags walletAddress={wallet.wallet_address} />
                    </td>
                    <td className='py-3 text-center'>
                      <span className='bg-primary text-primary-foreground rounded-full px-3 py-1 text-sm font-bold'>
                        {wallet.token_count}
                      </span>
                    </td>
                    <td className='py-3'>
                      <div className='flex flex-wrap gap-2'>
                        {wallet.token_names.map((name, idx) => (
                          <a
                            key={idx}
                            href={`https://solscan.io/token/${wallet.token_addresses[idx]}`}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='bg-muted hover:bg-muted/80 rounded px-2 py-1 text-xs'
                          >
                            {name}
                          </a>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tokens Table */}
      <TokensTable tokens={data.tokens} />
    </div>
  );
}
