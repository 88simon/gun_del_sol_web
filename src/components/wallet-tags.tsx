'use client';

import { useState, useEffect } from 'react';
import { getWalletTags, addWalletTag, removeWalletTag } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus, Tag } from 'lucide-react';
import { toast } from 'sonner';

interface WalletTagsProps {
  walletAddress: string;
  compact?: boolean;
}

export function WalletTags({ walletAddress, compact = false }: WalletTagsProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [showInput, setShowInput] = useState(false);

  useEffect(() => {
    loadTags();
  }, [walletAddress]);

  const loadTags = async () => {
    try {
      const walletTags = await getWalletTags(walletAddress);
      setTags(walletTags);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim()) return;

    setLoading(true);
    try {
      await addWalletTag(walletAddress, newTag.trim());
      setTags([...tags, newTag.trim()]);
      setNewTag('');
      setShowInput(false);
      toast.success('Tag added');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add tag');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTag = async (tag: string) => {
    setLoading(true);
    try {
      await removeWalletTag(walletAddress, tag);
      setTags(tags.filter((t) => t !== tag));
      toast.success('Tag removed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove tag');
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <div className='flex flex-wrap items-center gap-1'>
        {tags.map((tag) => (
          <span
            key={tag}
            className='bg-primary/10 text-primary rounded px-2 py-0.5 text-xs'
          >
            {tag}
          </span>
        ))}
        {tags.length === 0 && (
          <span className='text-muted-foreground text-xs'>No tags</span>
        )}
      </div>
    );
  }

  return (
    <div className='space-y-2'>
      <div className='flex flex-wrap items-center gap-2'>
        {tags.map((tag) => (
          <div
            key={tag}
            className='bg-primary/10 text-primary flex items-center gap-1 rounded-md px-2 py-1 text-sm'
          >
            <Tag className='h-3 w-3' />
            <span>{tag}</span>
            <Button
              variant='ghost'
              size='sm'
              className='h-4 w-4 p-0 hover:bg-transparent'
              onClick={() => handleRemoveTag(tag)}
              disabled={loading}
            >
              <X className='h-3 w-3' />
            </Button>
          </div>
        ))}

        {showInput ? (
          <div className='flex items-center gap-1'>
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTag();
                if (e.key === 'Escape') {
                  setShowInput(false);
                  setNewTag('');
                }
              }}
              placeholder='Tag name'
              className='h-7 w-32 text-sm'
              autoFocus
              disabled={loading}
            />
            <Button
              variant='ghost'
              size='sm'
              className='h-7 w-7 p-0'
              onClick={handleAddTag}
              disabled={loading}
            >
              <Plus className='h-3 w-3' />
            </Button>
          </div>
        ) : (
          <Button
            variant='outline'
            size='sm'
            className='h-7 text-xs'
            onClick={() => setShowInput(true)}
          >
            <Plus className='mr-1 h-3 w-3' />
            Add Tag
          </Button>
        )}
      </div>
    </div>
  );
}
