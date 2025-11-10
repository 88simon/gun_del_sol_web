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
  wallet_addresses?: string[];
}

export interface Wallet {
  id: number;
  wallet_address: string;
  first_buy_timestamp: string;
  total_usd: number | null;
  transaction_count: number | null;
  average_buy_usd: number | null;
  wallet_balance_usd: number | null;
}

export interface WalletTag {
  tag: string;
  is_kol: boolean;
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

export interface MultiTokenWallet {
  wallet_address: string;
  token_count: number;
  token_names: string[];
  token_addresses: string[];
  token_ids: number[];
  wallet_balance_usd: number | null;
}

export interface MultiTokenWalletsResponse {
  total: number;
  wallets: MultiTokenWallet[];
}

export interface CodexWallet {
  wallet_address: string;
  tags: WalletTag[];
}

export interface CodexResponse {
  wallets: CodexWallet[];
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

/**
 * Fetch wallets that appear in multiple tokens
 */
export async function getMultiTokenWallets(
  minTokens: number = 2
): Promise<MultiTokenWalletsResponse> {
  const res = await fetch(
    `${API_BASE_URL}/multi-token-wallets?min_tokens=${minTokens}`,
    {
      cache: 'no-store'
    }
  );

  if (!res.ok) {
    throw new Error('Failed to fetch multi-token wallets');
  }

  return res.json();
}

/**
 * Get tags for a wallet address
 */
export async function getWalletTags(
  walletAddress: string
): Promise<WalletTag[]> {
  const res = await fetch(`${API_BASE_URL}/wallets/${walletAddress}/tags`, {
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error('Failed to fetch wallet tags');
  }

  const data = await res.json();
  return data.tags;
}

/**
 * Add a tag to a wallet
 */
export async function addWalletTag(
  walletAddress: string,
  tag: string,
  isKol: boolean = false
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/wallets/${walletAddress}/tags`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tag, is_kol: isKol })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to add tag');
  }
}

/**
 * Remove a tag from a wallet
 */
export async function removeWalletTag(
  walletAddress: string,
  tag: string
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/wallets/${walletAddress}/tags`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tag })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to remove tag');
  }
}

/**
 * Get all unique tags
 */
export async function getAllTags(): Promise<string[]> {
  const res = await fetch(`${API_BASE_URL}/tags`, {
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error('Failed to fetch tags');
  }

  const data = await res.json();
  return data.tags;
}

/**
 * Get all wallets in the Codex (wallets that have tags)
 */
export async function getCodexWallets(): Promise<CodexResponse> {
  const res = await fetch(`${API_BASE_URL}/codex`, {
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error('Failed to fetch Codex');
  }

  return res.json();
}

/**
 * Get all deleted tokens (trash)
 */
export async function getDeletedTokens(): Promise<TokensResponse> {
  const res = await fetch(`${API_BASE_URL}/api/tokens/trash`, {
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error('Failed to fetch deleted tokens');
  }

  return res.json();
}

/**
 * Restore a deleted token
 */
export async function restoreToken(tokenId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/tokens/${tokenId}/restore`, {
    method: 'POST',
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error('Failed to restore token');
  }
}

/**
 * Permanently delete a token
 */
export async function permanentDeleteToken(tokenId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/tokens/${tokenId}/permanent`, {
    method: 'DELETE',
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error('Failed to permanently delete token');
  }
}

/**
 * API Settings interface
 */
export interface ApiSettings {
  transactionLimit: number;
  minUsdFilter: number;
  walletCount: number;
  apiRateDelay: number;
  maxCreditsPerAnalysis: number;
  maxRetries: number;
}

/**
 * Analyze a token with custom API settings
 */
export async function analyzeToken(
  tokenAddress: string,
  apiSettings: ApiSettings
): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/analyze/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      address: tokenAddress,
      api_settings: apiSettings
    }),
    cache: 'no-store'
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to analyze token');
  }

  return res.json();
}
