'use client';

import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

interface ApiSettings {
  transactionLimit: number;
  minUsdFilter: number;
  walletCount: number;
  apiRateDelay: number;
  maxCreditsPerAnalysis: number;
  maxRetries: number;
}

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiSettings: ApiSettings;
  setApiSettings: (settings: ApiSettings) => void;
  defaultApiSettings: ApiSettings;
  children: React.ReactNode;
}

export function SettingsModal({
  open,
  onOpenChange,
  apiSettings,
  setApiSettings,
  defaultApiSettings,
  children
}: SettingsModalProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side='right'
        align='start'
        className='max-h-[400px] w-[280px] overflow-y-auto p-4'
      >
        <div className='mb-4 space-y-1'>
          <h3 className='text-sm font-semibold'>API Settings</h3>
          <p className='text-muted-foreground text-xs'>
            Token analysis parameters
          </p>
        </div>

        <div className='space-y-4'>
          {/* Transaction Limit */}
          <div className='space-y-1'>
            <Label className='text-xs'>Transaction Limit</Label>
            <div className='flex items-center gap-1'>
              <Button
                variant='outline'
                size='icon'
                className='h-7 w-7'
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
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                  };
                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                }}
                className='h-7 cursor-ew-resize text-center text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
              />
              <Button
                variant='outline'
                size='icon'
                className='h-7 w-7'
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
              <Button
                variant='ghost'
                size='icon'
                className='h-7 w-7'
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
          <div className='space-y-1'>
            <Label className='text-xs'>Min USD ($)</Label>
            <div className='flex items-center gap-1'>
              <Button
                variant='outline'
                size='icon'
                className='h-7 w-7'
                onClick={() =>
                  setApiSettings({
                    ...apiSettings,
                    minUsdFilter: Math.max(10, apiSettings.minUsdFilter - 10)
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
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                  };
                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                }}
                className='h-7 cursor-ew-resize text-center text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
              />
              <Button
                variant='outline'
                size='icon'
                className='h-7 w-7'
                onClick={() =>
                  setApiSettings({
                    ...apiSettings,
                    minUsdFilter: Math.min(500, apiSettings.minUsdFilter + 10)
                  })
                }
              >
                <ChevronRight className='h-3 w-3' />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                className='h-7 w-7'
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

          {/* Wallet Count */}
          <div className='space-y-1'>
            <Label className='text-xs'>Wallet Count</Label>
            <div className='flex items-center gap-1'>
              <Button
                variant='outline'
                size='icon'
                className='h-7 w-7'
                onClick={() =>
                  setApiSettings({
                    ...apiSettings,
                    walletCount: Math.max(5, apiSettings.walletCount - 5)
                  })
                }
              >
                <ChevronLeft className='h-3 w-3' />
              </Button>
              <Input
                type='number'
                value={apiSettings.walletCount}
                onChange={(e) =>
                  setApiSettings({
                    ...apiSettings,
                    walletCount: parseInt(e.target.value) || 0
                  })
                }
                onMouseDown={(e) => {
                  const startX = e.clientX;
                  const startValue = apiSettings.walletCount;
                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const diff =
                      Math.floor((moveEvent.clientX - startX) / 10) * 5;
                    const newValue = Math.max(
                      5,
                      Math.min(50, startValue + diff)
                    );
                    setApiSettings({
                      ...apiSettings,
                      walletCount: newValue
                    });
                  };
                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                  };
                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                }}
                className='h-7 cursor-ew-resize text-center text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
              />
              <Button
                variant='outline'
                size='icon'
                className='h-7 w-7'
                onClick={() =>
                  setApiSettings({
                    ...apiSettings,
                    walletCount: Math.min(50, apiSettings.walletCount + 5)
                  })
                }
              >
                <ChevronRight className='h-3 w-3' />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                className='h-7 w-7'
                onClick={() =>
                  setApiSettings({
                    ...apiSettings,
                    walletCount: defaultApiSettings.walletCount
                  })
                }
                title='Reset to default'
              >
                <RotateCcw className='h-3 w-3' />
              </Button>
            </div>
          </div>

          {/* Advanced Settings */}
          <details className='space-y-2'>
            <summary className='text-muted-foreground hover:text-foreground cursor-pointer text-xs font-medium'>
              Advanced Settings
            </summary>
            <div className='space-y-4 pt-2'>
              {/* API Rate Delay */}
              <div className='space-y-1'>
                <Label className='text-muted-foreground text-xs'>
                  API Rate Delay (ms)
                </Label>
                <Input
                  type='number'
                  value={apiSettings.apiRateDelay}
                  onChange={(e) =>
                    setApiSettings({
                      ...apiSettings,
                      apiRateDelay: parseInt(e.target.value) || 0
                    })
                  }
                  className='h-7 text-xs'
                />
              </div>

              {/* Max Credits Per Analysis */}
              <div className='space-y-1'>
                <Label className='text-muted-foreground text-xs'>
                  Max Credits Per Analysis
                </Label>
                <Input
                  type='number'
                  value={apiSettings.maxCreditsPerAnalysis}
                  onChange={(e) =>
                    setApiSettings({
                      ...apiSettings,
                      maxCreditsPerAnalysis: parseInt(e.target.value) || 0
                    })
                  }
                  className='h-7 text-xs'
                />
              </div>

              {/* Max Retries */}
              <div className='space-y-1'>
                <Label className='text-muted-foreground text-xs'>
                  Max Retries
                </Label>
                <Input
                  type='number'
                  value={apiSettings.maxRetries}
                  onChange={(e) =>
                    setApiSettings({
                      ...apiSettings,
                      maxRetries: parseInt(e.target.value) || 0
                    })
                  }
                  className='h-7 text-xs'
                />
              </div>
            </div>
          </details>

          {/* Current Settings JSON */}
          <details className='space-y-2'>
            <summary className='text-muted-foreground hover:text-foreground cursor-pointer text-xs font-medium'>
              View JSON
            </summary>
            <pre className='text-muted-foreground bg-muted mt-2 max-h-40 overflow-auto rounded p-3 text-xs'>
              {JSON.stringify(apiSettings, null, 2)}
            </pre>
          </details>
        </div>
      </PopoverContent>
    </Popover>
  );
}
