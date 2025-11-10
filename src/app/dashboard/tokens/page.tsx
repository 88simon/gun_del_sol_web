'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  getTokens,
  getMultiTokenWallets,
  TokensResponse,
  MultiTokenWalletsResponse
} from '@/lib/api';
import { shouldLog } from '@/lib/debug';
import { TokensTable } from './tokens-table';
import { Button } from '@/components/ui/button';
import {
  Copy,
  CalendarIcon,
  X,
  Settings,
  ChevronLeft,
  ChevronRight,
  RotateCcw
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WalletTagsProvider } from '@/contexts/WalletTagsContext';
import { useAnalysisNotifications } from '@/hooks/useAnalysisNotifications';

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

  // API Request Settings State
  const defaultApiSettings = {
    transactionLimit: 500,
    minUsdFilter: 50,
    maxWalletsToStore: 10,
    apiRateDelay: 100,
    maxCreditsPerAnalysis: 1000,
    maxRetries: 3
  };
  const [apiSettings, setApiSettings] = useState(defaultApiSettings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const isInitialLoadRef = useRef(true);

  // Load API settings from backend on mount (silently, no UI impact)
  useEffect(() => {
    fetch('http://localhost:5001/api/settings', { cache: 'no-store' })
      .then((res) => res.json())
      .then((settings) => {
        // Batch state updates to avoid extra render
        React.startTransition(() => {
          setApiSettings(settings);
          setSettingsLoaded(true);
        });
      })
      .catch((err) => {
        console.error('Failed to load API settings:', err);
        setSettingsLoaded(true);
      });
  }, []);

  // Update backend whenever settings change (but not on initial load)
  useEffect(() => {
    if (!settingsLoaded) return; // Skip if not loaded yet

    // Skip the first run (when settings are initially loaded from backend)
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    // Debounce to avoid too many requests (1 second wait after user stops adjusting)
    const timer = setTimeout(() => {
      fetch('http://localhost:5001/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiSettings)
      })
        .then((res) => res.json())
        .then((data) => {
          console.log('[Settings] Updated:', data.settings);
          // Show toast notification when settings are saved
          toast.success('Settings saved', {
            description: 'Will be used for next analysis',
            duration: 2000
          });
        })
        .catch((err) => {
          console.error('[Settings] Failed to update:', err);
          toast.error('Failed to save settings');
        });
    }, 1000);

    return () => clearTimeout(timer);
  }, [apiSettings, settingsLoaded]);

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
              } catch (error) {
                console.error('[Test] Failed to create notification:', error);
                toast.error(`Failed: ${error.message}`);
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
            <div className='mb-3'>
              <div className='text-muted-foreground text-sm font-medium'>
                API Request Settings
              </div>
              <details className='mt-2'>
                <summary className='text-muted-foreground hover:text-foreground cursor-pointer text-[10px]'>
                  View Current Settings in JSON Format
                </summary>
                <pre className='text-muted-foreground bg-muted mt-2 rounded p-2 text-[9px]'>
                  {JSON.stringify(apiSettings, null, 2)}
                </pre>
              </details>
            </div>
            <div className='space-y-2'>
              {/* Transaction Limit */}
              <div className='flex items-center justify-between'>
                <Label className='text-muted-foreground text-[10px]'>
                  Transactions
                </Label>
                <div className='flex items-center gap-1'>
                  <div className='flex items-center gap-0.5'>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-7 w-5 p-0'
                      onClick={() =>
                        setApiSettings({
                          ...apiSettings,
                          transactionLimit: Math.max(
                            100,
                            apiSettings.transactionLimit - 100
                          )
                        })
                      }
                    >
                      <ChevronLeft className='h-3 w-3' />
                    </Button>
                    <Input
                      type='number'
                      value={apiSettings.transactionLimit}
                      onChange={(e) =>
                        setApiSettings({
                          ...apiSettings,
                          transactionLimit: parseInt(e.target.value) || 0
                        })
                      }
                      onMouseDown={(e) => {
                        const startX = e.clientX;
                        const startValue = apiSettings.transactionLimit;
                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const diff =
                            Math.floor((moveEvent.clientX - startX) / 5) * 100;
                          const newValue = Math.max(
                            100,
                            Math.min(2000, startValue + diff)
                          );
                          setApiSettings({
                            ...apiSettings,
                            transactionLimit: newValue
                          });
                        };
                        const handleMouseUp = () => {
                          document.removeEventListener(
                            'mousemove',
                            handleMouseMove
                          );
                          document.removeEventListener(
                            'mouseup',
                            handleMouseUp
                          );
                        };
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                      className='h-7 w-16 cursor-ew-resize px-1 text-center text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
                    />
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-7 w-5 p-0'
                      onClick={() =>
                        setApiSettings({
                          ...apiSettings,
                          transactionLimit: Math.min(
                            2000,
                            apiSettings.transactionLimit + 100
                          )
                        })
                      }
                    >
                      <ChevronRight className='h-3 w-3' />
                    </Button>
                  </div>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='h-6 w-6 p-0'
                    onClick={() =>
                      setApiSettings({
                        ...apiSettings,
                        transactionLimit: defaultApiSettings.transactionLimit
                      })
                    }
                    title='Reset to default'
                  >
                    <RotateCcw className='h-3 w-3' />
                  </Button>
                </div>
              </div>

              {/* Min USD Filter */}
              <div className='flex items-center justify-between'>
                <Label className='text-muted-foreground text-[10px]'>
                  Min USD ($)
                </Label>
                <div className='flex items-center gap-1'>
                  <div className='flex items-center gap-0.5'>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-7 w-5 p-0'
                      onClick={() =>
                        setApiSettings({
                          ...apiSettings,
                          minUsdFilter: Math.max(
                            10,
                            apiSettings.minUsdFilter - 10
                          )
                        })
                      }
                    >
                      <ChevronLeft className='h-3 w-3' />
                    </Button>
                    <Input
                      type='number'
                      value={apiSettings.minUsdFilter}
                      onChange={(e) =>
                        setApiSettings({
                          ...apiSettings,
                          minUsdFilter: parseInt(e.target.value) || 0
                        })
                      }
                      onMouseDown={(e) => {
                        const startX = e.clientX;
                        const startValue = apiSettings.minUsdFilter;
                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const diff =
                            Math.floor((moveEvent.clientX - startX) / 5) * 10;
                          const newValue = Math.max(
                            10,
                            Math.min(500, startValue + diff)
                          );
                          setApiSettings({
                            ...apiSettings,
                            minUsdFilter: newValue
                          });
                        };
                        const handleMouseUp = () => {
                          document.removeEventListener(
                            'mousemove',
                            handleMouseMove
                          );
                          document.removeEventListener(
                            'mouseup',
                            handleMouseUp
                          );
                        };
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                      className='h-7 w-16 cursor-ew-resize px-1 text-center text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
                    />
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-7 w-5 p-0'
                      onClick={() =>
                        setApiSettings({
                          ...apiSettings,
                          minUsdFilter: Math.min(
                            500,
                            apiSettings.minUsdFilter + 10
                          )
                        })
                      }
                    >
                      <ChevronRight className='h-3 w-3' />
                    </Button>
                  </div>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='h-6 w-6 p-0'
                    onClick={() =>
                      setApiSettings({
                        ...apiSettings,
                        minUsdFilter: defaultApiSettings.minUsdFilter
                      })
                    }
                    title='Reset to default'
                  >
                    <RotateCcw className='h-3 w-3' />
                  </Button>
                </div>
              </div>

              {/* Max Wallets to Store */}
              <div className='flex items-center justify-between'>
                <Label className='text-muted-foreground text-[10px]'>
                  Max Wallets
                </Label>
                <div className='flex items-center gap-1'>
                  <div className='flex items-center gap-0.5'>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-7 w-5 p-0'
                      onClick={() =>
                        setApiSettings({
                          ...apiSettings,
                          maxWalletsToStore: Math.max(
                            5,
                            apiSettings.maxWalletsToStore - 5
                          )
                        })
                      }
                    >
                      <ChevronLeft className='h-3 w-3' />
                    </Button>
                    <Input
                      type='number'
                      value={apiSettings.maxWalletsToStore}
                      onChange={(e) =>
                        setApiSettings({
                          ...apiSettings,
                          maxWalletsToStore: parseInt(e.target.value) || 0
                        })
                      }
                      onMouseDown={(e) => {
                        const startX = e.clientX;
                        const startValue = apiSettings.maxWalletsToStore;
                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const diff =
                            Math.floor((moveEvent.clientX - startX) / 10) * 5;
                          const newValue = Math.max(
                            5,
                            Math.min(50, startValue + diff)
                          );
                          setApiSettings({
                            ...apiSettings,
                            maxWalletsToStore: newValue
                          });
                        };
                        const handleMouseUp = () => {
                          document.removeEventListener(
                            'mousemove',
                            handleMouseMove
                          );
                          document.removeEventListener(
                            'mouseup',
                            handleMouseUp
                          );
                        };
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                      className='h-7 w-16 cursor-ew-resize px-1 text-center text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
                    />
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-7 w-5 p-0'
                      onClick={() =>
                        setApiSettings({
                          ...apiSettings,
                          maxWalletsToStore: Math.min(
                            50,
                            apiSettings.maxWalletsToStore + 5
                          )
                        })
                      }
                    >
                      <ChevronRight className='h-3 w-3' />
                    </Button>
                  </div>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='h-6 w-6 p-0'
                    onClick={() =>
                      setApiSettings({
                        ...apiSettings,
                        maxWalletsToStore: defaultApiSettings.maxWalletsToStore
                      })
                    }
                    title='Reset to default'
                  >
                    <RotateCcw className='h-3 w-3' />
                  </Button>
                </div>
              </div>

              {/* API Rate Delay */}
              <div className='flex items-center justify-between'>
                <Label className='text-muted-foreground text-[10px]'>
                  Rate Delay (ms)
                </Label>
                <div className='flex items-center gap-1'>
                  <div className='flex items-center gap-0.5'>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-7 w-5 p-0'
                      onClick={() =>
                        setApiSettings({
                          ...apiSettings,
                          apiRateDelay: Math.max(
                            0,
                            apiSettings.apiRateDelay - 50
                          )
                        })
                      }
                    >
                      <ChevronLeft className='h-3 w-3' />
                    </Button>
                    <Input
                      type='number'
                      value={apiSettings.apiRateDelay}
                      onChange={(e) =>
                        setApiSettings({
                          ...apiSettings,
                          apiRateDelay: parseInt(e.target.value) || 0
                        })
                      }
                      onMouseDown={(e) => {
                        const startX = e.clientX;
                        const startValue = apiSettings.apiRateDelay;
                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const diff =
                            Math.floor((moveEvent.clientX - startX) / 2) * 50;
                          const newValue = Math.max(
                            0,
                            Math.min(1000, startValue + diff)
                          );
                          setApiSettings({
                            ...apiSettings,
                            apiRateDelay: newValue
                          });
                        };
                        const handleMouseUp = () => {
                          document.removeEventListener(
                            'mousemove',
                            handleMouseMove
                          );
                          document.removeEventListener(
                            'mouseup',
                            handleMouseUp
                          );
                        };
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                      className='h-7 w-16 cursor-ew-resize px-1 text-center text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
                    />
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-7 w-5 p-0'
                      onClick={() =>
                        setApiSettings({
                          ...apiSettings,
                          apiRateDelay: Math.min(
                            1000,
                            apiSettings.apiRateDelay + 50
                          )
                        })
                      }
                    >
                      <ChevronRight className='h-3 w-3' />
                    </Button>
                  </div>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='h-6 w-6 p-0'
                    onClick={() =>
                      setApiSettings({
                        ...apiSettings,
                        apiRateDelay: defaultApiSettings.apiRateDelay
                      })
                    }
                    title='Reset to default'
                  >
                    <RotateCcw className='h-3 w-3' />
                  </Button>
                </div>
              </div>

              {/* Max Credits Per Analysis */}
              <div className='flex items-center justify-between'>
                <Label className='text-muted-foreground text-[10px]'>
                  Max Credits
                </Label>
                <div className='flex items-center gap-1'>
                  <div className='flex items-center gap-0.5'>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-7 w-5 p-0'
                      onClick={() =>
                        setApiSettings({
                          ...apiSettings,
                          maxCreditsPerAnalysis: Math.max(
                            100,
                            apiSettings.maxCreditsPerAnalysis - 100
                          )
                        })
                      }
                    >
                      <ChevronLeft className='h-3 w-3' />
                    </Button>
                    <Input
                      type='number'
                      value={apiSettings.maxCreditsPerAnalysis}
                      onChange={(e) =>
                        setApiSettings({
                          ...apiSettings,
                          maxCreditsPerAnalysis: parseInt(e.target.value) || 0
                        })
                      }
                      onMouseDown={(e) => {
                        const startX = e.clientX;
                        const startValue = apiSettings.maxCreditsPerAnalysis;
                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const diff =
                            Math.floor((moveEvent.clientX - startX) / 5) * 100;
                          const newValue = Math.max(
                            100,
                            Math.min(5000, startValue + diff)
                          );
                          setApiSettings({
                            ...apiSettings,
                            maxCreditsPerAnalysis: newValue
                          });
                        };
                        const handleMouseUp = () => {
                          document.removeEventListener(
                            'mousemove',
                            handleMouseMove
                          );
                          document.removeEventListener(
                            'mouseup',
                            handleMouseUp
                          );
                        };
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                      className='h-7 w-16 cursor-ew-resize px-1 text-center text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
                    />
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-7 w-5 p-0'
                      onClick={() =>
                        setApiSettings({
                          ...apiSettings,
                          maxCreditsPerAnalysis: Math.min(
                            5000,
                            apiSettings.maxCreditsPerAnalysis + 100
                          )
                        })
                      }
                    >
                      <ChevronRight className='h-3 w-3' />
                    </Button>
                  </div>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='h-6 w-6 p-0'
                    onClick={() =>
                      setApiSettings({
                        ...apiSettings,
                        maxCreditsPerAnalysis:
                          defaultApiSettings.maxCreditsPerAnalysis
                      })
                    }
                    title='Reset to default'
                  >
                    <RotateCcw className='h-3 w-3' />
                  </Button>
                </div>
              </div>

              {/* Max Retries */}
              <div className='flex items-center justify-between'>
                <Label className='text-muted-foreground text-[10px]'>
                  Max Retries
                </Label>
                <div className='flex items-center gap-1'>
                  <div className='flex items-center gap-0.5'>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-7 w-5 p-0'
                      onClick={() =>
                        setApiSettings({
                          ...apiSettings,
                          maxRetries: Math.max(0, apiSettings.maxRetries - 1)
                        })
                      }
                    >
                      <ChevronLeft className='h-3 w-3' />
                    </Button>
                    <Input
                      type='number'
                      value={apiSettings.maxRetries}
                      onChange={(e) =>
                        setApiSettings({
                          ...apiSettings,
                          maxRetries: parseInt(e.target.value) || 0
                        })
                      }
                      onMouseDown={(e) => {
                        const startX = e.clientX;
                        const startValue = apiSettings.maxRetries;
                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const diff = Math.floor(
                            (moveEvent.clientX - startX) / 20
                          );
                          const newValue = Math.max(
                            0,
                            Math.min(10, startValue + diff)
                          );
                          setApiSettings({
                            ...apiSettings,
                            maxRetries: newValue
                          });
                        };
                        const handleMouseUp = () => {
                          document.removeEventListener(
                            'mousemove',
                            handleMouseMove
                          );
                          document.removeEventListener(
                            'mouseup',
                            handleMouseUp
                          );
                        };
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                      className='h-7 w-16 cursor-ew-resize px-1 text-center text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
                    />
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-7 w-5 p-0'
                      onClick={() =>
                        setApiSettings({
                          ...apiSettings,
                          maxRetries: Math.min(10, apiSettings.maxRetries + 1)
                        })
                      }
                    >
                      <ChevronRight className='h-3 w-3' />
                    </Button>
                  </div>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='h-6 w-6 p-0'
                    onClick={() =>
                      setApiSettings({
                        ...apiSettings,
                        maxRetries: defaultApiSettings.maxRetries
                      })
                    }
                    title='Reset to default'
                  >
                    <RotateCcw className='h-3 w-3' />
                  </Button>
                </div>
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
            <div className='overflow-x-auto'>
              <table className='w-full'>
                <thead>
                  <tr className='border-b'>
                    <th className='pr-4 pb-3 text-left font-medium'>
                      Wallet Address
                    </th>
                    <th className='px-4 pb-3 text-right font-medium'>
                      Balance (USD)
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
                  {multiWallets.wallets.map((wallet) => (
                    <tr key={wallet.wallet_address} className='border-b'>
                      <td className='py-3 pr-4 font-mono'>
                        <div className='flex items-center gap-2'>
                          <WalletAddressWithBotIndicator
                            walletAddress={wallet.wallet_address}
                          >
                            <a
                              href={`https://solscan.io/account/${wallet.wallet_address}`}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='text-primary hover:underline'
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tokens Table */}
        <TokensTable tokens={filteredTokens} onDelete={handleTokenDelete} />
      </div>
    </WalletTagsProvider>
  );
}
