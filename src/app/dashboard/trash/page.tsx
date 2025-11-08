'use client';

import { useEffect, useState } from 'react';
import {
  getDeletedTokens,
  restoreToken,
  permanentDeleteToken,
  TokensResponse,
  Token,
  formatTimestamp
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';

export default function TrashPage() {
  const [data, setData] = useState<TokensResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const fetchData = () => {
    setLoading(true);
    getDeletedTokens()
      .then((trashData) => {
        setData(trashData);
      })
      .catch((err) => {
        console.error('Failed to fetch trash:', err);
        setError(
          'Failed to load trash. Make sure Flask is running on localhost:5001'
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRestore = async (token: Token) => {
    setProcessingId(token.id);
    try {
      await restoreToken(token.id);
      toast.success(`"${token.token_name || 'Token'}" restored successfully`);
      fetchData();
    } catch (error) {
      console.error('Error restoring token:', error);
      toast.error('Failed to restore token. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handlePermanentDelete = async (token: Token) => {
    if (
      !window.confirm(
        `Permanently delete "${token.token_name || 'Unknown'}"?\n\nThis action CANNOT be undone. All associated data will be permanently removed.`
      )
    ) {
      return;
    }

    setProcessingId(token.id);
    try {
      await permanentDeleteToken(token.id);
      toast.success(`"${token.token_name || 'Token'}" permanently deleted`);
      fetchData();
    } catch (error) {
      console.error('Error permanently deleting token:', error);
      toast.error('Failed to delete token. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className='flex h-full items-center justify-center'>
        <div className='text-center'>
          <div className='text-lg font-medium'>Loading trash...</div>
          <div className='text-muted-foreground mt-2 text-sm'>
            Fetching deleted tokens
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
            {error || 'Failed to load trash'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex h-full flex-col space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Trash</h1>
          <p className='text-muted-foreground'>
            Restore or permanently delete tokens
          </p>
        </div>
      </div>

      {/* Stats Card */}
      <div className='bg-card rounded-lg border p-6'>
        <div className='text-muted-foreground text-sm font-medium'>
          Items in Trash
        </div>
        <div className='text-3xl font-bold'>{data.total}</div>
      </div>

      {/* Trash Table */}
      {data.tokens.length === 0 ? (
        <div className='bg-card rounded-lg border p-12 text-center'>
          <div className='text-muted-foreground'>
            Trash is empty. Deleted tokens will appear here.
          </div>
        </div>
      ) : (
        <div className='rounded-md border overflow-hidden'>
          <div className='overflow-x-auto max-w-full'>
            <Table className='w-full'>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Deleted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.tokens.map((token) => (
                  <TableRow key={token.id}>
                    <TableCell>
                      <div className='min-w-[120px]'>
                        <div className='font-medium text-sm'>
                          {token.token_name || 'Unknown'}
                        </div>
                        <div className='text-muted-foreground text-xs uppercase'>
                          {token.token_symbol || '-'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        <a
                          href={`https://solscan.io/token/${token.token_address}`}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-primary font-mono text-sm hover:underline'
                        >
                          {token.token_address.slice(0, 8)}...
                          {token.token_address.slice(-6)}
                        </a>
                        <Badge variant='secondary' className='font-mono text-xs'>
                          {token.acronym}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className='text-muted-foreground text-xs'>
                        {token.deleted_at
                          ? formatTimestamp(token.deleted_at)
                          : '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className='flex gap-2'>
                        <Button
                          variant='outline'
                          size='sm'
                          className='h-8'
                          onClick={() => handleRestore(token)}
                          disabled={processingId === token.id}
                        >
                          <RotateCcw className='h-4 w-4 mr-1' />
                          Restore
                        </Button>
                        <Button
                          variant='destructive'
                          size='sm'
                          className='h-8'
                          onClick={() => handlePermanentDelete(token)}
                          disabled={processingId === token.id}
                        >
                          <Trash2 className='h-4 w-4 mr-1' />
                          Delete Forever
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
