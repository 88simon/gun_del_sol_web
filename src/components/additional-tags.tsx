'use client';

import { useState, useEffect } from 'react';
import { getWalletTags, addWalletTag, removeWalletTag } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Tags } from 'lucide-react';
import { toast } from 'sonner';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useWalletTags } from '@/contexts/WalletTagsContext';

interface AdditionalTagsPopoverProps {
  walletId?: number;
  walletAddress: string;
  compact?: boolean;
}

export function AdditionalTagsPopover({
  walletId,
  walletAddress,
  compact = false
}: AdditionalTagsPopoverProps) {
  const { tags: allTags } = useWalletTags(walletAddress);
  const [loading, setLoading] = useState(false);

  // Extract only additional tags (bot, whale, insider) from context
  const tags = new Set(
    allTags
      .filter((t) => ['bot', 'whale', 'insider'].includes(t.tag.toLowerCase()))
      .map((t) => t.tag.toLowerCase())
  );

  const toggleTag = async (tag: string) => {
    setLoading(true);
    try {
      const tagLower = tag.toLowerCase();
      if (tags.has(tagLower)) {
        await removeWalletTag(walletAddress, tag);
        toast.success(`Removed ${tag} tag`);
      } else {
        await addWalletTag(walletAddress, tag, false);
        toast.success(`Added ${tag} tag`);
      }
      // Trigger a custom event to notify the context to refresh
      window.dispatchEvent(
        new CustomEvent('walletTagsChanged', { detail: { walletAddress } })
      );
    } catch (error: any) {
      toast.error(error.message || `Failed to update ${tag} tag`);
    } finally {
      setLoading(false);
    }
  };

  const iconClass = compact ? 'h-3 w-3' : 'h-4 w-4';
  const uniqueId = walletId ? `${walletId}` : walletAddress.slice(0, 8);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className={compact ? 'h-6 w-6 p-0' : ''}
        >
          <Tags className={iconClass} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-48'>
        <div className='space-y-3'>
          <h4 className='text-sm font-semibold'>Additional Tags</h4>
          <div className='space-y-2'>
            <div className='flex items-center space-x-2'>
              <Checkbox
                id={`bot-${uniqueId}`}
                checked={tags.has('bot')}
                onCheckedChange={() => toggleTag('Bot')}
                disabled={loading}
              />
              <Label
                htmlFor={`bot-${uniqueId}`}
                className='cursor-pointer text-sm'
              >
                Bot
              </Label>
            </div>
            <div className='flex items-center space-x-2'>
              <Checkbox
                id={`whale-${uniqueId}`}
                checked={tags.has('whale')}
                onCheckedChange={() => toggleTag('Whale')}
                disabled={loading}
              />
              <Label
                htmlFor={`whale-${uniqueId}`}
                className='cursor-pointer text-sm'
              >
                Whale
              </Label>
            </div>
            <div className='flex items-center space-x-2'>
              <Checkbox
                id={`insider-${uniqueId}`}
                checked={tags.has('insider')}
                onCheckedChange={() => toggleTag('Insider')}
                disabled={loading}
              />
              <Label
                htmlFor={`insider-${uniqueId}`}
                className='cursor-pointer text-sm'
              >
                Insider
              </Label>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Hook to check if a wallet has specific additional tags
export function useWalletBotTag(walletAddress: string) {
  const [isBot, setIsBot] = useState(false);

  useEffect(() => {
    checkBotTag();
  }, [walletAddress]);

  const checkBotTag = async () => {
    try {
      const walletTags = await getWalletTags(walletAddress);
      const hasBot = walletTags.some((t) => t.tag.toLowerCase() === 'bot');
      setIsBot(hasBot);
    } catch (error) {
      console.error('Failed to check bot tag:', error);
    }
  };

  return isBot;
}

// Component to display wallet address with bot emoji if tagged
export function WalletAddressWithBotIndicator({
  walletAddress,
  children,
  onTagsChange
}: {
  walletAddress: string;
  children: React.ReactNode;
  onTagsChange?: () => void;
}) {
  const { tags, isLoading } = useWalletTags(walletAddress);
  const isBot = tags.some((t) => t.tag.toLowerCase() === 'bot');

  return (
    <>
      {isBot && <span className='mr-1'>🤖</span>}
      {children}
    </>
  );
}
