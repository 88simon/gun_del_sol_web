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
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TokenDetailsModal } from './token-details-modal';

const createColumns = (
  handleViewDetails: (id: number) => void,
  handleDelete: (id: number) => void
): ColumnDef<Token>[] => [
  {
    accessorKey: 'token_name',
    header: 'Token',
    cell: ({ row }) => {
      const name = row.original.token_name || 'Unknown';
      const symbol = row.original.token_symbol || '-';
      return (
        <div>
          <div className='font-medium'>{name}</div>
          <div className='text-muted-foreground text-sm uppercase'>
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
      const short = `${address.slice(0, 8)}...${address.slice(-6)}`;
      return (
        <div className='flex items-center gap-2'>
          <a
            href={`https://solscan.io/token/${address}`}
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary font-mono text-sm hover:underline'
          >
            {short}
          </a>
          <Button
            variant='ghost'
            size='sm'
            className='h-6 w-6 p-0'
            onClick={() => {
              navigator.clipboard.writeText(address);
              toast.success('Address copied to clipboard');
            }}
          >
            <Copy className='h-3 w-3' />
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
      return (
        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => handleViewDetails(token.id)}
          >
            <Eye className='h-4 w-4' />
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => downloadAxiomJson(token as any)}
          >
            <Download className='h-4 w-4' />
          </Button>
          <Button
            variant='destructive'
            size='sm'
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
            <Trash2 className='h-4 w-4' />
          </Button>
        </div>
      );
    }
  },
  {
    accessorKey: 'acronym',
    header: 'Acronym',
    cell: ({ row }) => (
      <Badge variant='secondary' className='font-mono'>
        {row.getValue('acronym')}
      </Badge>
    )
  },
  {
    accessorKey: 'wallets_found',
    header: 'Wallets',
    cell: ({ row }) => (
      <div className='text-center'>
        <Badge variant='outline'>{row.getValue('wallets_found')} wallets</Badge>
      </div>
    )
  },
  {
    accessorKey: 'last_analysis_credits',
    header: 'Credits Used For Latest Report',
    cell: ({ row }) => (
      <div className='font-semibold text-green-600'>
        {row.getValue('last_analysis_credits') || 0}
      </div>
    )
  },
  {
    accessorKey: 'credits_used',
    header: 'Cumulative Credits Used',
    cell: ({ row }) => (
      <div className='font-semibold text-orange-500'>
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
        <div className='text-muted-foreground text-sm'>
          {formatTimestamp(timestamp)}
        </div>
      );
    }
  },
  {
    accessorKey: 'analysis_timestamp',
    header: 'Analyzed',
    cell: ({ row }) => {
      const timestamp = row.getValue('analysis_timestamp') as string;
      return (
        <div className='text-muted-foreground text-sm'>
          {formatTimestamp(timestamp)}
        </div>
      );
    }
  }
];

interface TokensTableProps {
  tokens: Token[];
}

export function TokensTable({ tokens }: TokensTableProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenDetail | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [globalFilter, setGlobalFilter] = useState('');

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
    try {
      const response = await fetch(`http://localhost:5001/api/tokens/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete token');
      }

      // Refresh the page to show updated data
      router.refresh();
    } catch (error) {
      console.error('Error deleting token:', error);
      alert('Failed to delete token. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = createColumns(handleViewDetails, handleDelete);

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

        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
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
                      <TableCell key={cell.id}>
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
