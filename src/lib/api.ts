/**
 * Gun Del Sol API Client
 * Fetches data from the Flask backend running on localhost:5001
 */

const API_BASE_URL = 'http://localhost:5001';

export interface Token {
  id: number;
  token_address: string;
  token_name: string | null;
  token_symbol: string | null;
  acronym: string;
  analysis_timestamp: string;
  first_buy_timestamp: string | null;
  wallets_found: number;
  credits_used?: number;
  last_analysis_credits?: number;
}

export interface Wallet {
  id: number;
  wallet_address: string;
  first_buy_timestamp: string;
  total_usd: number | null;
  transaction_count: number | null;
  average_buy_usd: number | null;
}

export interface TokenDetail extends Token {
  wallets: Wallet[];
  axiom_json: any[];
}

export interface AnalysisRun {
  id: number;
  analysis_timestamp: string;
  wallets_found: number;
  credits_used: number;
  wallets: Wallet[];
}

export interface AnalysisHistory {
  token_id: number;
  total_runs: number;
  runs: AnalysisRun[];
}

export interface TokensResponse {
  total: number;
  total_wallets: number;
  tokens: Token[];
}

/**
 * Fetch all analyzed tokens
 */
export async function getTokens(): Promise<TokensResponse> {
  const res = await fetch(`${API_BASE_URL}/api/tokens/history`, {
    cache: 'no-store' // Always fetch fresh data
  });

  if (!res.ok) {
    throw new Error('Failed to fetch tokens');
  }

  return res.json();
}

/**
 * Fetch details for a specific token
 */
export async function getTokenById(id: number): Promise<TokenDetail> {
  const res = await fetch(`${API_BASE_URL}/api/tokens/${id}`, {
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error('Failed to fetch token details');
  }

  return res.json();
}

/**
 * Fetch analysis history for a specific token
 */
export async function getTokenAnalysisHistory(
  id: number
): Promise<AnalysisHistory> {
  const res = await fetch(`${API_BASE_URL}/api/tokens/${id}/history`, {
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error('Failed to fetch analysis history');
  }

  return res.json();
}

/**
 * Download Axiom JSON for a token
 */
export function downloadAxiomJson(token: TokenDetail) {
  const dataStr = JSON.stringify(token.axiom_json, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${token.acronym}_axiom_export.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Format UTC timestamp to local time
 */
export function formatTimestamp(timestamp: string): string {
  if (!timestamp) return '-';
  // SQLite returns UTC without 'Z', so we append it
  const utcTimestamp = timestamp.replace(' ', 'T') + 'Z';
  const date = new Date(utcTimestamp);
  return date.toLocaleString();
}

/**
 * Format timestamp to short date
 */
export function formatShortDate(timestamp: string): string {
  if (!timestamp) return '-';
  const utcTimestamp = timestamp.replace(' ', 'T') + 'Z';
  const date = new Date(utcTimestamp);
  return date.toLocaleDateString();
}
