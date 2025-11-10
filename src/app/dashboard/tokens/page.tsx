'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  getTokens,
  getMultiTokenWallets,
  TokensResponse,
  MultiTokenWalletsResponse,
  refreshWalletBalances
} from '@/lib/api';
import { shouldLog } from '@/lib/debug';
import { TokensTable } from './tokens-table';
import { Button } from '@/components/ui/button';
import {
  Copy,
  CalendarIcon,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { WalletTags } from '@/components/wallet-tags';
import {
  AdditionalTagsPopover,
  WalletAddressWithBotIndicator
} from '@/components/additional-tags';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { WalletTagsProvider } from '@/contexts/WalletTagsContext';
import { useAnalysisNotifications } from '@/hooks/useAnalysisNotifications';
import { useApiSettings } from '@/contexts/ApiSettingsContext';

export default function TokensPage() {
  const [data, setData] = useState<TokensResponse | null>(null);
  const [multiWallets, setMultiWallets] =
    useState<MultiTokenWalletsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const [hasActiveJobs, setHasActiveJobs] = useState(false);
  const [pollsSinceLastActive, setPollsSinceLastActive] = useState(0);
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });
  const hasInitializedPolling = useRef(false);

  // Multi-token wallet panel state
  const [isWalletPanelExpanded, setIsWalletPanelExpanded] = useState(false);
  const [walletPage, setWalletPage] = useState(0);
  const [selectedWallets, setSelectedWallets] = useState<Set<string>>(
    new Set()
  );
  const walletsPerPage = 5;

  // Use API settings from context
  const { apiSettings } = useApiSettings();

  const fetchData = () => {
    setLoading(true);
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
  };

  // WebSocket notifications for real-time analysis updates
  useAnalysisNotifications((data) => {
    if (shouldLog()) {
      console.log('[WebSocket] Analysis completed, refreshing data...', data);
    }
    // Refresh the tokens list when analysis completes
    fetchData();
  });

  const handleTokenDelete = (tokenId: number) => {
    // Optimistically update UI by removing the token from local state
    if (data) {
      setData({
        ...data,
        tokens: data.tokens.filter((token) => token.id !== tokenId),
        total: data.total - 1
      });
    }
  };

  useEffect(() => {
    // Fetch tokens and multi-token wallets from Flask API
    fetchData();

    // Request notification permission silently (no test notification on every refresh)
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        console.log('Notification permission:', permission);
      });
    }
  }, []);

  // Poll for active analysis jobs and auto-refresh when they complete
  useEffect(() => {
    // Guard against React Strict Mode double-mounting
    if (hasInitializedPolling.current) return;
    hasInitializedPolling.current = true;

    const isFirstPollRef = { current: true };

    // Initialize lastJobId on mount to prevent showing old notifications
    const initializeLastJobId = async () => {
      try {
        const response = await fetch('http://localhost:5001/analysis');
        const analysisData = await response.json();

        if (analysisData.jobs && analysisData.jobs.length > 0) {
          const latestJob = analysisData.jobs[0];
          if (latestJob.status === 'completed') {
            setLastJobId(latestJob.job_id);
            console.log('[Poll] Initialized lastJobId to:', latestJob.job_id);
          }

          // Check if there are any active jobs
          const activeJobs = analysisData.jobs.some(
            (job: any) => job.status === 'queued' || job.status === 'processing'
          );
          setHasActiveJobs(activeJobs);
        }
      } catch (err) {
        console.error('Failed to initialize lastJobId:', err);
      }
    };

    initializeLastJobId();

    const pollInterval = setInterval(async () => {
      // Skip the first poll since we already initialized
      if (isFirstPollRef.current) {
        isFirstPollRef.current = false;
        return;
      }

      // OPTIMIZATION: Only poll if there are active jobs or if we haven't checked recently
      // Check every 10th poll even when no active jobs (to catch new analyses started from AHK)
      if (!hasActiveJobs && pollsSinceLastActive < 10) {
        console.log('[Poll] No active jobs, skipping poll');
        setPollsSinceLastActive(pollsSinceLastActive + 1);
        return;
      }

      // Reset counter when we do poll
      setPollsSinceLastActive(0);

      try {
        const response = await fetch('http://localhost:5001/analysis');
        const analysisData = await response.json();

        if (analysisData.jobs && analysisData.jobs.length > 0) {
          const latestJob = analysisData.jobs[0];

          // Update hasActiveJobs state
          const activeJobs = analysisData.jobs.some(
            (job: any) => job.status === 'queued' || job.status === 'processing'
          );
          setHasActiveJobs(activeJobs);

          console.log(
            `[Poll] Latest job: ${latestJob.job_id}, Last seen: ${lastJobId}, Status: ${latestJob.status}, Active jobs: ${activeJobs}`
          );

          // Check if there's a new completed job we haven't seen yet
          if (
            latestJob.status === 'completed' &&
            latestJob.job_id !== lastJobId
          ) {
            console.log(
              '[Poll] New analysis completed! Showing notification...'
            );
            setLastJobId(latestJob.job_id);
            // Refresh the tokens list without showing loading state
            Promise.all([getTokens(), getMultiTokenWallets(2)])
              .then(([tokensData, walletsData]) => {
                setData(tokensData);
                setMultiWallets(walletsData);

                const tokenName = latestJob.token_name || 'Token';
                toast.success(`Analysis complete: ${tokenName}`);

                // Show desktop notification if permission granted
                if (
                  'Notification' in window &&
                  Notification.permission === 'granted'
                ) {
                  const notification = new Notification('Analysis Complete ✓', {
                    body: `${tokenName} analysis finished\nClick to view results`,
                    icon: '/favicon.ico',
                    tag: 'analysis-complete',
                    requireInteraction: false,
                    silent: true // No sound
                  });

                  // Auto-close notification after 0.75 seconds
                  setTimeout(() => notification.close(), 750);

                  // Focus window when notification is clicked
                  notification.onclick = () => {
                    window.focus();
                    notification.close();
                  };
                }
              })
              .catch((err) => {
                console.error('Failed to refresh data:', err);
              });
          }
        } else {
          // No jobs at all, stop polling
          setHasActiveJobs(false);
        }
      } catch (err) {
        // Silently fail - don't spam errors if backend is temporarily unavailable
        console.error('Failed to check analysis status:', err);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [lastJobId, hasActiveJobs]);

  // Pause polling when page is hidden (tab switched or minimized)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[Poll] Page hidden, pausing updates');
      } else {
        console.log('[Poll] Page visible, resuming updates');
        // Check for new jobs immediately when tab becomes visible
        if (hasActiveJobs) {
          fetchData();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [hasActiveJobs]);

  // Collect all unique wallet addresses for batch tag fetching
  // MUST be before early returns to comply with Rules of Hooks
  const allWalletAddresses = useMemo(() => {
    const addresses = new Set<string>();

    // Add wallets from multi-token wallets
    if (multiWallets?.wallets) {
      multiWallets.wallets.forEach((wallet) => {
        addresses.add(wallet.wallet_address);
      });
    }

    return Array.from(addresses);
  }, [multiWallets]);

  // Wallet panel helpers
  const handleWalletRowClick = (
    walletAddress: string,
    event: React.MouseEvent
  ) => {
    // Don't select if clicking on a link, button, or interactive element
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'A' ||
      target.tagName === 'BUTTON' ||
      target.closest('a') ||
      target.closest('button')
    ) {
      return;
    }

    setSelectedWallets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(walletAddress)) {
        newSet.delete(walletAddress);
      } else {
        newSet.add(walletAddress);
      }
      return newSet;
    });
  };

  const handleRefreshBalances = async (walletAddressesOverride?: string[]) => {
    const walletAddresses =
      walletAddressesOverride || Array.from(selectedWallets);

    if (walletAddresses.length === 0) {
      toast.error('No wallets selected');
      return;
    }

    toast.info(
      `Refreshing balances for ${walletAddresses.length} wallet(s)...`
    );

    try {
      const response = await refreshWalletBalances(walletAddresses);

      // Refresh the multi-token wallets data to show updated balances
      const walletsData = await getMultiTokenWallets(2);
      setMultiWallets(walletsData);

      toast.success(
        `Refreshed ${response.successful} of ${response.total_wallets} wallet(s) (${response.api_credits_used} API credits used)`
      );

      // Clear selection after refresh only if using selected wallets (not single wallet)
      if (!walletAddressesOverride) {
        setSelectedWallets(new Set());
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to refresh balances');
      console.error('[Balance Refresh] Error:', error);
    }
  };

  // Pagination logic for multi-token wallets
  const walletsToDisplay = useMemo(() => {
    if (!multiWallets?.wallets) return [];

    if (isWalletPanelExpanded) {
      return multiWallets.wallets;
    }

    const start = walletPage * walletsPerPage;
    const end = start + walletsPerPage;
    return multiWallets.wallets.slice(start, end);
  }, [multiWallets, isWalletPanelExpanded, walletPage]);

  const totalWalletPages = useMemo(() => {
    if (!multiWallets?.wallets) return 0;
    return Math.ceil(multiWallets.wallets.length / walletsPerPage);
  }, [multiWallets]);

  if (loading) {
    return (
      <WalletTagsProvider walletAddresses={allWalletAddresses}>
        <div className='flex h-full items-center justify-center'>
          <div className='text-center'>
            <div className='text-lg font-medium'>Loading tokens...</div>
            <div className='text-muted-foreground mt-2 text-sm'>
              Fetching data from Flask backend
            </div>
          </div>
        </div>
      </WalletTagsProvider>
    );
  }

  if (error || !data) {
    return (
      <WalletTagsProvider walletAddresses={allWalletAddresses}>
        <div className='flex h-full items-center justify-center'>
          <div className='text-center'>
            <div className='text-destructive text-lg font-medium'>Error</div>
            <div className='text-muted-foreground mt-2 text-sm'>
              {error || 'Failed to load tokens'}
            </div>
          </div>
        </div>
      </WalletTagsProvider>
    );
  }

  // Filter tokens by date range
  const filteredTokens = data.tokens.filter((token) => {
    // If no dates selected, show all tokens
    if (!dateRange.from && !dateRange.to) return true;

    const tokenDate = new Date(
      token.analysis_timestamp.replace(' ', 'T') + 'Z'
    );

    if (dateRange.from && dateRange.to) {
      const endOfDay = new Date(dateRange.to);
      endOfDay.setHours(23, 59, 59, 999);
      return tokenDate >= dateRange.from && tokenDate <= endOfDay;
    } else if (dateRange.from) {
      return tokenDate >= dateRange.from;
    } else if (dateRange.to) {
      const endOfDay = new Date(dateRange.to);
      endOfDay.setHours(23, 59, 59, 999);
      return tokenDate <= endOfDay;
    }

    return false;
  });

  return (
    <WalletTagsProvider walletAddresses={allWalletAddresses}>
      <div className='flex h-full flex-col space-y-4'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>
              Analyzed Tokens
            </h1>
            <p className='text-muted-foreground'>
              View and manage your analyzed Solana tokens
            </p>
          </div>
          <Button
            variant='outline'
            size='sm'
            onClick={() => {
              console.log(
                '[Test] Notification API available:',
                'Notification' in window
              );
              console.log('[Test] Permission status:', Notification.permission);

              if (!('Notification' in window)) {
                toast.error('Notifications not supported in this browser');
                return;
              }

              if (Notification.permission !== 'granted') {
                toast.error(
                  `Permission: ${Notification.permission}. Please allow notifications.`
                );
                return;
              }

              try {
                console.log('[Test] Creating notification...');
                const testNotif = new Notification('Test Notification', {
                  body: 'This is a test notification. Tab out to test!',
                  icon: '/favicon.ico',
                  tag: 'test-notif',
                  requireInteraction: false,
                  silent: false
                });

                testNotif.onshow = () =>
                  console.log('[Test] Notification shown');
                testNotif.onclick = () => {
                  console.log('[Test] Notification clicked');
                  window.focus();
                };
                testNotif.onerror = (e) =>
                  console.error('[Test] Notification error:', e);

                setTimeout(() => testNotif.close(), 5000);
                toast.success(
                  'Test notification created! Check if it appears.'
                );
              } catch (error: any) {
                console.error('[Test] Failed to create notification:', error);
                toast.error(`Failed: ${error.message || 'Unknown error'}`);
              }
            }}
          >
            Test Notification
          </Button>
        </div>

        {/* Stats Cards */}
        <div className='grid gap-4 md:grid-cols-3'>
          <div className='bg-card rounded-lg border p-6'>
            <div className='flex items-center justify-between'>
              <div className='text-muted-foreground text-sm font-medium'>
                Tokens Scanned
                {(dateRange.from || dateRange.to) && (
                  <span className='ml-2 text-xs'>
                    ({filteredTokens.length} filtered)
                  </span>
                )}
              </div>
              <div className='flex items-center gap-1'>
                {(dateRange.from || dateRange.to) && (
                  <Button
                    variant='ghost'
                    size='sm'
                    className='h-6 w-6 p-0'
                    onClick={() =>
                      setDateRange({ from: undefined, to: undefined })
                    }
                  >
                    <X className='h-3 w-3' />
                  </Button>
                )}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant='ghost' size='sm' className='h-8 w-8 p-0'>
                      <CalendarIcon className='h-4 w-4' />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className='w-auto p-0' align='start'>
                    <div className='p-3'>
                      <div className='mb-2 text-sm font-medium'>
                        Filter by Scan Date
                      </div>
                      <div className='space-y-2'>
                        <Calendar
                          mode='range'
                          selected={{ from: dateRange.from, to: dateRange.to }}
                          onSelect={(range: any) =>
                            setDateRange({ from: range?.from, to: range?.to })
                          }
                          numberOfMonths={1}
                          defaultMonth={new Date()}
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className='text-3xl font-bold'>{filteredTokens.length}</div>
            <div className='mt-3 border-t pt-3'>
              <div className='text-muted-foreground mb-1 text-xs font-medium'>
                Latest Analysis
              </div>
              <div className='text-sm font-medium'>
                {data.tokens[0]
                  ? new Date(
                      data.tokens[0].analysis_timestamp.replace(' ', 'T') + 'Z'
                    ).toLocaleString()
                  : '-'}
              </div>
            </div>
          </div>
          <div className='bg-card rounded-lg border p-6'>
            <div className='text-muted-foreground text-sm font-medium'>
              Multi-Token Wallets
            </div>
            <div className='text-3xl font-bold'>{multiWallets?.total || 0}</div>
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

            {/* Top Selection Controls */}
            {selectedWallets.size > 0 && (
              <div className='bg-primary/10 border-primary/20 mb-4 flex items-center justify-center gap-2 rounded-md border p-2'>
                <span className='text-primary text-sm font-medium'>
                  {selectedWallets.size} wallet
                  {selectedWallets.size !== 1 ? 's' : ''} selected
                </span>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setSelectedWallets(new Set())}
                  className='h-7 text-xs'
                >
                  Deselect All
                </Button>
              </div>
            )}

            <div
              className={`overflow-x-auto ${isWalletPanelExpanded ? 'max-h-[600px] overflow-y-auto' : ''}`}
            >
              <table className='w-full'>
                <thead
                  className={
                    isWalletPanelExpanded ? 'bg-card sticky top-0 z-10' : ''
                  }
                >
                  <tr className='border-b'>
                    <th className='pr-4 pb-3 text-left font-medium'>
                      Wallet Address
                    </th>
                    <th className='px-4 pb-3 text-right font-medium'>
                      Balance (USD)
                    </th>
                    <th className='px-4 pb-3 text-center font-medium'>
                      Refresh Balance
                    </th>
                    <th className='px-4 pb-3 text-left font-medium'>Tags</th>
                    <th className='px-4 pb-3 text-center font-medium'>
                      Tokens
                    </th>
                    <th className='pb-3 pl-4 text-left font-medium'>
                      Token Names
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {walletsToDisplay.map((wallet) => {
                    const isSelected = selectedWallets.has(
                      wallet.wallet_address
                    );
                    return (
                      <motion.tr
                        key={wallet.wallet_address}
                        className={`cursor-pointer border-b ${
                          isSelected ? 'bg-primary/20' : ''
                        }`}
                        onClick={(e) =>
                          handleWalletRowClick(wallet.wallet_address, e)
                        }
                        initial={false}
                        animate={{
                          backgroundColor: isSelected
                            ? 'rgba(var(--primary-rgb, 59 130 246) / 0.2)'
                            : 'transparent',
                          boxShadow: isSelected
                            ? 'inset 0 0 0 2px rgba(var(--primary-rgb, 59 130 246) / 0.3), 0 0 10px rgba(var(--primary-rgb, 59 130 246) / 0.2)'
                            : 'none'
                        }}
                        whileHover={{
                          backgroundColor: isSelected
                            ? 'rgba(var(--primary-rgb, 59 130 246) / 0.25)'
                            : 'rgba(var(--muted-rgb, 240 240 240) / 0.5)',
                          boxShadow: isSelected
                            ? 'inset 0 0 0 2px rgba(var(--primary-rgb, 59 130 246) / 0.4), 0 0 15px rgba(var(--primary-rgb, 59 130 246) / 0.3)'
                            : '0 1px 3px rgba(0, 0, 0, 0.05)'
                        }}
                        whileTap={{
                          backgroundColor: isSelected
                            ? 'rgba(var(--primary-rgb, 59 130 246) / 0.3)'
                            : 'rgba(var(--muted-rgb, 240 240 240) / 0.7)'
                        }}
                        transition={{
                          type: 'spring',
                          stiffness: 500,
                          damping: 30,
                          mass: 0.5
                        }}
                      >
                        <td className='py-3 pr-4'>
                          <div className='flex items-center gap-2'>
                            <WalletAddressWithBotIndicator
                              walletAddress={wallet.wallet_address}
                            >
                              <a
                                href={`https://solscan.io/account/${wallet.wallet_address}`}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='text-primary font-sans text-xs hover:underline'
                              >
                                {wallet.wallet_address}
                              </a>
                            </WalletAddressWithBotIndicator>
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
                        <td className='px-4 py-3 text-right font-mono text-sm'>
                          {wallet.wallet_balance_usd !== null &&
                          wallet.wallet_balance_usd !== undefined
                            ? `$${Math.round(wallet.wallet_balance_usd)}`
                            : 'N/A'}
                        </td>
                        <td className='px-4 py-3 text-center'>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-6 w-6 p-0'
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRefreshBalances([wallet.wallet_address]);
                            }}
                            title={`Refresh balance - 1 API credit`}
                          >
                            <RefreshCw className='h-3 w-3' />
                          </Button>
                        </td>
                        <td className='px-4 py-3'>
                          <div className='flex items-center gap-2'>
                            <WalletTags walletAddress={wallet.wallet_address} />
                            <AdditionalTagsPopover
                              walletAddress={wallet.wallet_address}
                              compact
                            />
                          </div>
                        </td>
                        <td className='px-4 py-3 text-center'>
                          <span className='bg-primary text-primary-foreground rounded-full px-3 py-1 text-sm font-bold'>
                            {wallet.token_count}
                          </span>
                        </td>
                        <td className='py-3 pl-4'>
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
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Collapse/Expand Controls */}
            <div className='mt-4 border-t pt-4'>
              {/* Wallet count info */}
              <div className='mb-3 flex items-center justify-center'>
                <div className='text-muted-foreground text-sm'>
                  {isWalletPanelExpanded ? (
                    <>Showing all {multiWallets.wallets.length} wallets</>
                  ) : (
                    <>
                      Showing {walletsToDisplay.length} of{' '}
                      {multiWallets.wallets.length} wallets
                    </>
                  )}
                </div>
              </div>

              {/* Bottom Selection Controls */}
              {selectedWallets.size > 0 && (
                <div className='bg-primary/10 border-primary/20 mb-3 flex items-center justify-center gap-2 rounded-md border p-2'>
                  <span className='text-primary text-sm font-medium'>
                    {selectedWallets.size} wallet
                    {selectedWallets.size !== 1 ? 's' : ''} selected
                  </span>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setSelectedWallets(new Set())}
                    className='h-7 text-xs'
                  >
                    Deselect All
                  </Button>
                </div>
              )}

              {/* Centered pagination and expand/collapse */}
              <div className='flex items-center justify-center gap-3'>
                {/* Pagination controls (only when collapsed) */}
                {!isWalletPanelExpanded && totalWalletPages > 1 && (
                  <div className='flex items-center gap-1'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setWalletPage((p) => Math.max(0, p - 1))}
                      disabled={walletPage === 0}
                      className='h-7 px-2'
                    >
                      <ChevronUp className='h-3 w-3' />
                    </Button>
                    <span className='text-muted-foreground px-2 text-xs'>
                      Page {walletPage + 1} / {totalWalletPages}
                    </span>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() =>
                        setWalletPage((p) =>
                          Math.min(totalWalletPages - 1, p + 1)
                        )
                      }
                      disabled={walletPage >= totalWalletPages - 1}
                      className='h-7 px-2'
                    >
                      <ChevronDown className='h-3 w-3' />
                    </Button>
                  </div>
                )}

                {/* Expand/Collapse button */}
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setIsWalletPanelExpanded((prev) => !prev)}
                  className='h-7'
                >
                  {isWalletPanelExpanded ? (
                    <>
                      <ChevronUp className='mr-1 h-4 w-4' />
                      Collapse
                    </>
                  ) : (
                    <>
                      <ChevronDown className='mr-1 h-4 w-4' />
                      Expand All
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tokens Table */}
        <TokensTable tokens={filteredTokens} onDelete={handleTokenDelete} />
      </div>
    </WalletTagsProvider>
  );
}
