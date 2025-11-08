'use client';

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  useReactTable
} from '@tanstack/react-table';
import {
  Token,
  TokenDetail,
  formatTimestamp,
  downloadAxiomJson,
  getTokenById
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Eye, Download, Trash2, Search, Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TokenDetailsModal } from './token-details-modal';
import { useCodex } from '@/contexts/codex-context';
import { cn } from '@/lib/utils';

const createColumns = (
  handleViewDetails: (id: number) => void,
  handleDelete: (id: number) => void,
  isCompact: boolean = false
): ColumnDef<Token>[] => [
  {
    accessorKey: 'token_name',
    header: 'Token',
    cell: ({ row }) => {
      const name = row.original.token_name || 'Unknown';
      const symbol = row.original.token_symbol || '-';
      return (
        <div className='min-w-[120px]'>
          <div className={cn('font-medium', isCompact ? 'text-xs' : 'text-sm')}>{name}</div>
          <div className={cn('text-muted-foreground uppercase', isCompact ? 'text-[10px]' : 'text-xs')}>
            {symbol}
          </div>
        </div>
      );
    }
  },
  {
    accessorKey: 'token_address',
    header: 'Address',
    cell: ({ row }) => {
      const address = row.getValue('token_address') as string;
      const short = isCompact ? `${address.slice(0, 6)}...${address.slice(-4)}` : `${address.slice(0, 8)}...${address.slice(-6)}`;
      return (
        <div className='flex items-center gap-1 min-w-[100px]'>
          <a
            href={`https://solscan.io/token/${address}`}
            target='_blank'
            rel='noopener noreferrer'
            className={cn('text-primary font-mono hover:underline', isCompact ? 'text-[10px]' : 'text-sm')}
          >
            {short}
          </a>
          <Button
            variant='ghost'
            size='sm'
            className={cn('p-0', isCompact ? 'h-5 w-5' : 'h-6 w-6')}
            onClick={() => {
              navigator.clipboard.writeText(address);
              toast.success('Address copied to clipboard');
            }}
          >
            <Copy className={cn(isCompact ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
          </Button>
        </div>
      );
    }
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => {
      const token = row.original;
      const btnSize = isCompact ? 'h-7 w-7' : 'h-8 w-8';
      const iconSize = isCompact ? 'h-3 w-3' : 'h-4 w-4';
      return (
        <div className={cn('flex', isCompact ? 'gap-1' : 'gap-2')}>
          <Button
            variant='outline'
            size='sm'
            className={cn('p-0', btnSize)}
            onClick={() => handleViewDetails(token.id)}
          >
            <Eye className={iconSize} />
          </Button>
          <Button
            variant='outline'
            size='sm'
            className={cn('p-0', btnSize)}
            onClick={() => downloadAxiomJson(token as any)}
          >
            <Download className={iconSize} />
          </Button>
          <Button
            variant='destructive'
            size='sm'
            className={cn('p-0', btnSize)}
            onClick={() => {
              if (
                window.confirm(
                  `Delete token "${token.token_name || 'Unknown'}"?`
                )
              ) {
                handleDelete(token.id);
              }
            }}
          >
            <Trash2 className={iconSize} />
          </Button>
        </div>
      );
    }
  },
  {
    accessorKey: 'acronym',
    header: 'Acronym',
    cell: ({ row }) => (
      <Badge variant='secondary' className={cn('font-mono', isCompact ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5')}>
        {row.getValue('acronym')}
      </Badge>
    )
  },
  {
    accessorKey: 'wallets_found',
    header: 'Wallets',
    cell: ({ row }) => (
      <div className='text-center'>
        <Badge variant='outline' className={cn(isCompact ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5')}>{row.getValue('wallets_found')}</Badge>
      </div>
    )
  },
  {
    accessorKey: 'last_analysis_credits',
    header: isCompact ? 'Latest Credits' : 'Credits Used For Latest Report',
    cell: ({ row }) => (
      <div className={cn('font-semibold text-green-600', isCompact ? 'text-xs' : 'text-sm')}>
        {row.getValue('last_analysis_credits') || 0}
      </div>
    )
  },
  {
    accessorKey: 'credits_used',
    header: isCompact ? 'Total Credits' : 'Cumulative Credits Used',
    cell: ({ row }) => (
      <div className={cn('font-semibold text-orange-500', isCompact ? 'text-xs' : 'text-sm')}>
        {row.getValue('credits_used') || 0}
      </div>
    )
  },
  {
    accessorKey: 'first_buy_timestamp',
    header: 'First Buy',
    cell: ({ row }) => {
      const timestamp = row.getValue('first_buy_timestamp') as string;
      return (
        <div className={cn('text-muted-foreground', isCompact ? 'text-[10px]' : 'text-xs')}>
          {formatTimestamp(timestamp)}
        </div>
      );
    }
  }
];

interface TokensTableProps {
  tokens: Token[];
  onDelete?: (tokenId: number) => void;
}

export function TokensTable({ tokens, onDelete }: TokensTableProps) {
  const router = useRouter();
  const { isCodexOpen } = useCodex();
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenDetail | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [globalFilter, setGlobalFilter] = useState('');
  const [isCompactMode, setIsCompactMode] = useState(isCodexOpen);

  // Delay compact mode change to sync with Codex animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsCompactMode(isCodexOpen);
    }, isCodexOpen ? 0 : 100);
    return () => clearTimeout(timer);
  }, [isCodexOpen]);

  const handleViewDetails = async (id: number) => {
    setIsLoadingDetails(true);
    try {
      const tokenDetails = await getTokenById(id);
      setSelectedToken(tokenDetails);
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error loading token details:', error);
      alert('Failed to load token details. Please try again.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleDelete = async (id: number) => {
    setIsDeleting(true);

    // Optimistically update UI immediately
    if (onDelete) {
      onDelete(id);
    }

    try {
      const response = await fetch(`http://localhost:5001/api/tokens/${id}`, {
        method: 'DELETE',
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('Failed to delete token');
      }

      toast.success('Token deleted successfully');
    } catch (error) {
      console.error('Error deleting token:', error);
      toast.error('Failed to delete token. Please try again.');
      // On error, refresh to restore correct state
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = useMemo(
    () => createColumns(handleViewDetails, handleDelete, isCompactMode),
    [isCompactMode]
  );

  const table = useReactTable({
    data: tokens,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      globalFilter
    },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, columnId, filterValue) => {
      const search = filterValue.toLowerCase();
      // Search in token address, token name, token symbol, acronym
      const tokenData = row.original;
      return (
        tokenData.token_address?.toLowerCase().includes(search) ||
        tokenData.token_name?.toLowerCase().includes(search) ||
        tokenData.token_symbol?.toLowerCase().includes(search) ||
        tokenData.acronym?.toLowerCase().includes(search)
      );
    }
  });

  return (
    <>
      <div className='space-y-4'>
        {/* Search Input */}
        <div className='flex items-center gap-2'>
          <div className='relative flex-1'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              placeholder='Search by token address or wallet address...'
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className='pl-10'
            />
          </div>
        </div>

        <div className='rounded-md border overflow-hidden'>
          <div className='overflow-x-auto max-w-full'>
            <Table className='w-full'>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className={cn('whitespace-nowrap transition-all duration-300', isCompactMode ? 'text-xs px-2 py-2' : 'text-sm px-3 py-3')}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className={cn('transition-all duration-300', isCompactMode ? 'px-2 py-2' : 'px-3 py-3')}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className='h-24 text-center'
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className='flex items-center justify-end space-x-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Token Details Modal */}
      <TokenDetailsModal
        token={selectedToken}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
