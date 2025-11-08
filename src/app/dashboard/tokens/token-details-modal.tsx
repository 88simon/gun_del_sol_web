'use client';

import {
  TokenDetail,
  formatTimestamp,
  downloadAxiomJson,
  getTokenAnalysisHistory,
  AnalysisHistory
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, ExternalLink, Copy, X, History } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TokenDetailsModalProps {
  token: TokenDetail | null;
  open: boolean;
  onClose: () => void;
}

export function TokenDetailsModal({
  token,
  open,
  onClose
}: TokenDetailsModalProps) {
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<AnalysisHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fetch analysis history when modal opens
  useEffect(() => {
    if (open && token) {
      setLoadingHistory(true);
      getTokenAnalysisHistory(token.id)
        .then(setHistory)
        .catch((err) => {
          console.error('Failed to fetch analysis history:', err);
          setHistory(null);
        })
        .finally(() => setLoadingHistory(false));
    }
  }, [open, token]);

  if (!token) return null;

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className='max-h-[90vh] w-[95vw] max-w-[95vw] overflow-y-auto'>
        <DialogHeader>
          <div className='flex items-center justify-between'>
            <div>
              <DialogTitle className='text-2xl'>
                {token.token_name || 'Unknown Token'}
              </DialogTitle>
              <p className='text-muted-foreground mt-1 text-sm'>
                {token.token_symbol || '-'} • Early Buyer Analysis
              </p>
            </div>
            <Button
              variant='outline'
              size='sm'
              onClick={() => downloadAxiomJson(token)}
            >
              <Download className='mr-2 h-4 w-4' />
              Axiom JSON
            </Button>
          </div>
        </DialogHeader>

        {/* Token Info Grid */}
        <div className='mt-4 grid grid-cols-4 gap-4'>
          <div className='rounded-lg border p-4'>
            <div className='text-muted-foreground mb-2 text-sm font-medium'>
              Token Address
            </div>
            <div className='flex items-center gap-2'>
              <code className='text-xs break-all'>
                {token.token_address.slice(0, 16)}...
              </code>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => copyAddress(token.token_address)}
              >
                {copied ? 'Copied!' : <Copy className='h-4 w-4' />}
              </Button>
            </div>
            <a
              href={`https://solscan.io/token/${token.token_address}`}
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary mt-2 flex items-center text-xs hover:underline'
            >
              View on Solscan <ExternalLink className='ml-1 h-3 w-3' />
            </a>
          </div>

          <div className='rounded-lg border p-4'>
            <div className='text-muted-foreground mb-2 text-sm font-medium'>
              Acronym
            </div>
            <Badge variant='secondary' className='font-mono text-lg'>
              {token.acronym}
            </Badge>
          </div>

          <div className='rounded-lg border p-4'>
            <div className='text-muted-foreground mb-2 text-sm font-medium'>
              Wallets Found
            </div>
            <div className='text-2xl font-bold'>{token.wallets_found}</div>
          </div>

          <div className='rounded-lg border p-4'>
            <div className='text-muted-foreground mb-2 text-sm font-medium'>
              Analyzed
            </div>
            <div className='text-sm'>
              {formatTimestamp(token.analysis_timestamp)}
            </div>
          </div>
        </div>

        {/* Tabs for Current Analysis and History */}
        <Tabs defaultValue='current' className='mt-6'>
          <TabsList className='grid w-full grid-cols-2'>
            <TabsTrigger value='current'>Latest Analysis</TabsTrigger>
            <TabsTrigger value='history'>
              <History className='mr-2 h-4 w-4' />
              History ({history?.total_runs || 0} runs)
            </TabsTrigger>
          </TabsList>

          {/* Current Analysis Tab */}
          <TabsContent value='current'>
            <div className='mt-4 rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-[60px]'>Rank</TableHead>
                    <TableHead>Wallet Address</TableHead>
                    <TableHead className='text-right'>Actions</TableHead>
                    <TableHead>First Buy Time</TableHead>
                    <TableHead className='text-right'>Amount (USD)</TableHead>
                    <TableHead className='text-center'>Txns</TableHead>
                    <TableHead className='text-right'>Avg Buy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {token.wallets.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className='text-muted-foreground py-12 text-center'
                      >
                        No wallets found
                      </TableCell>
                    </TableRow>
                  ) : (
                    token.wallets.map((wallet, index) => (
                      <TableRow key={wallet.id}>
                        <TableCell className='text-primary font-semibold'>
                          #{index + 1}
                        </TableCell>
                        <TableCell className='font-mono text-sm'>
                          {wallet.wallet_address}
                        </TableCell>
                        <TableCell className='text-right'>
                          <div className='flex justify-end gap-2'>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() => copyAddress(wallet.wallet_address)}
                            >
                              <Copy className='h-4 w-4' />
                            </Button>
                            <a
                              href={`https://solscan.io/account/${wallet.wallet_address}`}
                              target='_blank'
                              rel='noopener noreferrer'
                            >
                              <Button variant='outline' size='sm'>
                                <ExternalLink className='h-4 w-4' />
                              </Button>
                            </a>
                          </div>
                        </TableCell>
                        <TableCell className='text-sm'>
                          {formatTimestamp(wallet.first_buy_timestamp)}
                        </TableCell>
                        <TableCell className='text-right'>
                          {wallet.total_usd
                            ? `$${Math.round(wallet.total_usd)}`
                            : 'N/A'}
                        </TableCell>
                        <TableCell className='text-center'>
                          {wallet.transaction_count || 1}
                        </TableCell>
                        <TableCell className='text-right'>
                          {wallet.average_buy_usd
                            ? `$${Math.round(wallet.average_buy_usd)}`
                            : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value='history'>
            {loadingHistory ? (
              <div className='text-muted-foreground py-12 text-center'>
                Loading analysis history...
              </div>
            ) : !history || history.runs.length === 0 ? (
              <div className='text-muted-foreground py-12 text-center'>
                No analysis history available
              </div>
            ) : (
              <div className='mt-4 space-y-6'>
                {history.runs.map((run, runIndex) => (
                  <div key={run.id} className='rounded-lg border p-4'>
                    <div className='mb-3 flex items-center justify-between'>
                      <div>
                        <h4 className='text-sm font-semibold'>
                          Analysis #{history.runs.length - runIndex}
                          {runIndex === 0 && (
                            <Badge variant='secondary' className='ml-2'>
                              Latest
                            </Badge>
                          )}
                        </h4>
                        <p className='text-muted-foreground text-xs'>
                          {formatTimestamp(run.analysis_timestamp)}
                        </p>
                      </div>
                      <div className='text-right text-sm'>
                        <div className='font-semibold'>
                          {run.wallets_found} wallets
                        </div>
                        <div className='text-muted-foreground text-xs'>
                          {run.credits_used} credits
                        </div>
                      </div>
                    </div>

                    <div className='rounded-md border'>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className='w-[60px]'>Rank</TableHead>
                            <TableHead>Wallet Address</TableHead>
                            <TableHead className='text-right'>
                              Actions
                            </TableHead>
                            <TableHead>First Buy Time</TableHead>
                            <TableHead className='text-right'>
                              Amount (USD)
                            </TableHead>
                            <TableHead className='text-center'>Txns</TableHead>
                            <TableHead className='text-right'>
                              Avg Buy
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {run.wallets.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className='text-muted-foreground py-8 text-center text-sm'
                              >
                                No wallets in this run
                              </TableCell>
                            </TableRow>
                          ) : (
                            run.wallets.map((wallet, index) => (
                              <TableRow key={wallet.id}>
                                <TableCell className='text-primary text-sm font-semibold'>
                                  #{index + 1}
                                </TableCell>
                                <TableCell className='font-mono text-xs'>
                                  {wallet.wallet_address}
                                </TableCell>
                                <TableCell className='text-right'>
                                  <div className='flex justify-end gap-1'>
                                    <Button
                                      variant='ghost'
                                      size='sm'
                                      onClick={() =>
                                        copyAddress(wallet.wallet_address)
                                      }
                                    >
                                      <Copy className='h-3 w-3' />
                                    </Button>
                                    <a
                                      href={`https://solscan.io/account/${wallet.wallet_address}`}
                                      target='_blank'
                                      rel='noopener noreferrer'
                                    >
                                      <Button variant='outline' size='sm'>
                                        <ExternalLink className='h-3 w-3' />
                                      </Button>
                                    </a>
                                  </div>
                                </TableCell>
                                <TableCell className='text-xs'>
                                  {formatTimestamp(wallet.first_buy_timestamp)}
                                </TableCell>
                                <TableCell className='text-right text-sm'>
                                  {wallet.total_usd
                                    ? `$${Math.round(wallet.total_usd)}`
                                    : 'N/A'}
                                </TableCell>
                                <TableCell className='text-center text-sm'>
                                  {wallet.transaction_count || 1}
                                </TableCell>
                                <TableCell className='text-right text-sm'>
                                  {wallet.average_buy_usd
                                    ? `$${Math.round(wallet.average_buy_usd)}`
                                    : 'N/A'}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
