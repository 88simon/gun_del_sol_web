'use client';

import { useState, useEffect, useRef } from 'react';
import { getWalletTags, addWalletTag, removeWalletTag, WalletTag } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus, Tag } from 'lucide-react';
import { toast } from 'sonner';

interface WalletTagsProps {
  walletAddress: string;
  compact?: boolean;
}

type InputStep = 'tag' | 'kol';

export function WalletTags({ walletAddress, compact = false }: WalletTagsProps) {
  const [tags, setTags] = useState<WalletTag[]>([]);
  const [newTag, setNewTag] = useState('');
  const [kolValue, setKolValue] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [inputStep, setInputStep] = useState<InputStep>('tag');
  const inputRef = useRef<HTMLDivElement>(null);
  const kolToggleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTags();
  }, [walletAddress]);

  // Auto-focus the KOL toggle when it appears
  useEffect(() => {
    if (inputStep === 'kol' && kolToggleRef.current) {
      kolToggleRef.current.focus();
    }
  }, [inputStep]);

  // Close input when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowInput(false);
        setNewTag('');
        setKolValue(false);
        setInputStep('tag');
      }
    };

    if (showInput) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showInput]);

  const loadTags = async () => {
    try {
      const walletTags = await getWalletTags(walletAddress);
      setTags(walletTags);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const handleTagNameSubmit = () => {
    if (!newTag.trim()) return;
    // Move to KOL step and default to Y (true)
    setKolValue(true);
    setInputStep('kol');
  };

  const handleKolSubmit = async () => {
    setLoading(true);
    try {
      await addWalletTag(walletAddress, newTag.trim(), kolValue);
      setTags([...tags, { tag: newTag.trim(), is_kol: kolValue }]);
      setNewTag('');
      setKolValue(false);
      setInputStep('tag');
      setShowInput(false);
      toast.success('Tag added');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add tag');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTag = async (tagName: string) => {
    setLoading(true);
    try {
      await removeWalletTag(walletAddress, tagName);
      setTags(tags.filter((t) => t.tag !== tagName));
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
        {tags.map((tagObj) => (
          <span
            key={tagObj.tag}
            className={`rounded px-2 py-0.5 text-xs ${
              tagObj.is_kol
                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 font-semibold'
                : 'bg-primary/10 text-primary'
            }`}
          >
            {tagObj.is_kol && '★ '}
            {tagObj.tag}
          </span>
        ))}
        {tags.length === 0 && (
          <span className='text-muted-foreground text-xs'>No tags</span>
        )}
      </div>
    );
  }

  return (
    <div className='flex flex-wrap items-center gap-1'>
      {tags.map((tagObj) => (
        <div
          key={tagObj.tag}
          className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
            tagObj.is_kol
              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 font-semibold'
              : 'bg-primary/10 text-primary'
          }`}
        >
          <Tag className='h-3 w-3' />
          <span>
            {tagObj.is_kol && '★ '}
            {tagObj.tag}
          </span>
          <Button
            variant='ghost'
            size='sm'
            className='h-3 w-3 p-0 hover:bg-transparent'
            onClick={() => handleRemoveTag(tagObj.tag)}
            disabled={loading}
          >
            <X className='h-2.5 w-2.5' />
          </Button>
        </div>
      ))}

      {showInput ? (
        <div ref={inputRef} className='flex items-center gap-1'>
          {inputStep === 'tag' ? (
            <>
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTagNameSubmit();
                  if (e.key === 'Escape') {
                    setShowInput(false);
                    setNewTag('');
                  }
                }}
                placeholder='Tag name'
                className='h-6 w-24 text-xs'
                autoFocus
                disabled={loading}
              />
              <Button
                variant='ghost'
                size='sm'
                className='h-6 w-6 p-0'
                onClick={handleTagNameSubmit}
                disabled={loading}
              >
                <Plus className='h-3 w-3' />
              </Button>
            </>
          ) : (
            <>
              <div
                ref={kolToggleRef}
                className='flex items-center gap-1 rounded border border-input bg-background px-2 h-6'
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    handleKolSubmit();
                  } else if (e.key === 'Escape') {
                    setShowInput(false);
                    setNewTag('');
                    setKolValue(false);
                    setInputStep('tag');
                  } else if (e.key === 'y' || e.key === 'Y') {
                    setLoading(true);
                    try {
                      await addWalletTag(walletAddress, newTag.trim(), true);
                      setTags([...tags, { tag: newTag.trim(), is_kol: true }]);
                      setNewTag('');
                      setKolValue(false);
                      setInputStep('tag');
                      setShowInput(false);
                      toast.success('Tag added');
                    } catch (error: any) {
                      toast.error(error.message || 'Failed to add tag');
                    } finally {
                      setLoading(false);
                    }
                  } else if (e.key === 'n' || e.key === 'N') {
                    setLoading(true);
                    try {
                      await addWalletTag(walletAddress, newTag.trim(), false);
                      setTags([...tags, { tag: newTag.trim(), is_kol: false }]);
                      setNewTag('');
                      setKolValue(false);
                      setInputStep('tag');
                      setShowInput(false);
                      toast.success('Tag added');
                    } catch (error: any) {
                      toast.error(error.message || 'Failed to add tag');
                    } finally {
                      setLoading(false);
                    }
                  } else if (e.key === 'ArrowLeft') {
                    setKolValue(true);
                  } else if (e.key === 'ArrowRight') {
                    setKolValue(false);
                  }
                }}
                tabIndex={0}
              >
                <span className='text-xs text-muted-foreground'>KOL?</span>
                <button
                  type='button'
                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                    kolValue
                      ? 'bg-green-500/20 text-green-700 dark:text-green-400 font-semibold'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                  onClick={() => setKolValue(true)}
                  disabled={loading}
                >
                  Y
                </button>
                <button
                  type='button'
                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                    !kolValue
                      ? 'bg-red-500/20 text-red-700 dark:text-red-400 font-semibold'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                  onClick={() => setKolValue(false)}
                  disabled={loading}
                >
                  N
                </button>
              </div>
              <Button
                variant='ghost'
                size='sm'
                className='h-6 w-6 p-0'
                onClick={handleKolSubmit}
                disabled={loading}
              >
                <Plus className='h-3 w-3' />
              </Button>
            </>
          )}
        </div>
      ) : (
        <Button
          variant='ghost'
          size='sm'
          className='h-6 w-6 p-0'
          onClick={() => setShowInput(true)}
          title='Add tag'
        >
          <Tag className='h-3.5 w-3.5' />
        </Button>
      )}
    </div>
  );
}
