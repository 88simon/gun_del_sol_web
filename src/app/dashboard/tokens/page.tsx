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

export default function TokensPage() {
  const [data, setData] = useState<TokensResponse | null>(null);
  const [multiWallets, setMultiWallets] =
    useState<MultiTokenWalletsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });

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
  }, []);

  // Poll for active analysis jobs and auto-refresh when they complete
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('http://localhost:5001/analysis');
        const analysisData = await response.json();

        if (analysisData.jobs && analysisData.jobs.length > 0) {
          const latestJob = analysisData.jobs[0];

          // Check if there's a new completed job we haven't seen yet
          if (
            latestJob.status === 'completed' &&
            latestJob.job_id !== lastJobId
          ) {
            console.log('New analysis completed, refreshing data...');
            setLastJobId(latestJob.job_id);
            // Refresh the tokens list without showing loading state
            Promise.all([getTokens(), getMultiTokenWallets(2)])
              .then(([tokensData, walletsData]) => {
                setData(tokensData);
                setMultiWallets(walletsData);
                toast.success(
                  `Analysis complete: ${latestJob.token_name || 'Token'}`
                );
              })
              .catch((err) => {
                console.error('Failed to refresh data:', err);
              });
          }
        }
      } catch (err) {
        // Silently fail - don't spam errors if backend is temporarily unavailable
        console.error('Failed to check analysis status:', err);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [lastJobId]);

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
                        document.removeEventListener('mouseup', handleMouseUp);
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
                        document.removeEventListener('mouseup', handleMouseUp);
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
                        document.removeEventListener('mouseup', handleMouseUp);
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
                        apiRateDelay: Math.max(0, apiSettings.apiRateDelay - 50)
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
                        document.removeEventListener('mouseup', handleMouseUp);
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
                        document.removeEventListener('mouseup', handleMouseUp);
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
                        document.removeEventListener('mouseup', handleMouseUp);
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
                        <WalletAddressWithBotIndicator
                          walletAddress={wallet.wallet_address}
                        >
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
                    <td className='py-3'>
                      <div className='flex items-center gap-2'>
                        <WalletTags walletAddress={wallet.wallet_address} />
                        <AdditionalTagsPopover
                          walletAddress={wallet.wallet_address}
                          compact
                        />
                      </div>
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
      <TokensTable tokens={filteredTokens} onDelete={handleTokenDelete} />
    </div>
  );
}
