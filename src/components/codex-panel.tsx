'use client';

import { useState, useEffect } from 'react';
import { getCodexWallets, CodexWallet } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Search, Tag, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CodexPanelProps {
  open: boolean;
  onClose: () => void;
}

export function CodexPanel({ open, onClose }: CodexPanelProps) {
  const [wallets, setWallets] = useState<CodexWallet[]>([]);
  const [filteredWallets, setFilteredWallets] = useState<CodexWallet[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadWallets();
    }
  }, [open]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredWallets(wallets);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = wallets.filter((wallet) => {
      const addressMatch = wallet.wallet_address.toLowerCase().includes(query);
      const tagMatch = wallet.tags.some((tag) =>
        tag.tag.toLowerCase().includes(query)
      );
      return addressMatch || tagMatch;
    });
    setFilteredWallets(filtered);
  }, [searchQuery, wallets]);

  const loadWallets = async () => {
    setLoading(true);
    try {
      const data = await getCodexWallets();
      setWallets(data.wallets);
      setFilteredWallets(data.wallets);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load Codex');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div
      className={cn(
        'bg-background flex flex-col border-l transition-all duration-300 ease-in-out',
        open ? 'w-[700px]' : 'w-0 border-l-0'
      )}
    >
      {open && (
        <div className='flex h-full flex-col overflow-hidden'>
          {/* Header */}
          <div className='flex items-center justify-between border-b p-4'>
            <div>
              <h2 className='text-lg font-semibold'>Codex</h2>
              <p className='text-muted-foreground text-sm'>
                View all tagged wallets. Click to copy address.
              </p>
            </div>
            <button
              onClick={onClose}
              className='rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden'
            >
              <X className='h-4 w-4' />
              <span className='sr-only'>Close</span>
            </button>
          </div>

          {/* Search */}
          <div className='relative p-4 pb-2'>
            <Search className='text-muted-foreground absolute top-1/2 left-7 h-4 w-4 -translate-y-1/2 transform' />
            <Input
              placeholder='Search by wallet address or tag...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='pl-10'
            />
          </div>

          {/* Wallet List */}
          <div className='flex-1 space-y-2 overflow-y-auto px-4 py-2'>
            {loading ? (
              <div className='text-muted-foreground py-8 text-center'>
                Loading...
              </div>
            ) : filteredWallets.length === 0 ? (
              <div className='text-muted-foreground py-8 text-center'>
                {searchQuery
                  ? 'No wallets match your search'
                  : 'No tagged wallets found'}
              </div>
            ) : (
              filteredWallets.map((wallet) => (
                <div
                  key={wallet.wallet_address}
                  className='hover:bg-muted/50 cursor-pointer rounded-lg border p-3 transition-colors'
                  onClick={() => copyToClipboard(wallet.wallet_address)}
                >
                  <div className='mb-2 font-mono text-sm break-all'>
                    {wallet.wallet_address}
                  </div>
                  <div className='flex flex-wrap items-center gap-1'>
                    {wallet.tags.map((tagObj) => (
                      <span
                        key={tagObj.tag}
                        className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs ${
                          tagObj.is_kol
                            ? 'bg-amber-500/20 font-semibold text-amber-700 dark:text-amber-400'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        <Tag className='h-3 w-3' />
                        {tagObj.is_kol && '★ '}
                        {tagObj.tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className='text-muted-foreground border-t p-4 text-sm'>
            Showing {filteredWallets.length} of {wallets.length} wallets
          </div>
        </div>
      )}
    </div>
  );
}
