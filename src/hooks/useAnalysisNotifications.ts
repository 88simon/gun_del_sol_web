'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { initDebugMode, shouldLog } from '@/lib/debug';

interface AnalysisCompleteData {
  job_id: string;
  token_name: string;
  token_symbol: string;
  acronym: string;
  wallets_found: number;
  token_id: number;
}

interface AnalysisStartData {
  job_id: string;
  token_name: string;
  token_symbol: string;
}

interface WebSocketMessage {
  event: 'analysis_complete' | 'analysis_start';
  data: AnalysisCompleteData | AnalysisStartData;
}

export function useAnalysisNotifications(
  onComplete?: (data: AnalysisCompleteData) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    // Initialize debug mode from backend
    initDebugMode();

    const connect = () => {
      if (!isSubscribed) return;

      // Connect to FastAPI WebSocket server
      const ws = new WebSocket('ws://localhost:5002/ws');
      wsRef.current = ws;

      ws.onopen = () => {
        if (shouldLog()) {
          console.log('[WebSocket] Connected to FastAPI WebSocket server');
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          if (shouldLog()) {
            console.log('[WebSocket] Received message:', message);
          }

          if (message.event === 'analysis_complete') {
            const data = message.data as AnalysisCompleteData;

            // Show toast notification
            toast.success(`Analysis complete: ${data.token_name}`, {
              description: `Found ${data.wallets_found} early bidder wallets`,
              duration: 5000
            });

            // Show desktop notification if permission granted
            if (
              'Notification' in window &&
              Notification.permission === 'granted'
            ) {
              const notification = new Notification('Analysis Complete ✓', {
                body: `${data.token_name} (${data.acronym})\n${data.wallets_found} wallets found`,
                icon: '/favicon.ico',
                tag: 'analysis-complete',
                requireInteraction: false,
                silent: true
              });

              // Auto-close after 3 seconds
              setTimeout(() => notification.close(), 3000);

              notification.onclick = () => {
                window.focus();
                notification.close();
              };
            }

            // Call the callback if provided
            if (onComplete) {
              onComplete(data);
            }
          } else if (message.event === 'analysis_start') {
            const data = message.data as AnalysisStartData;
            toast.info(`Analysis started: ${data.token_name}`, {
              description: 'Processing early bidders...',
              duration: 3000
            });
          }
        } catch (error) {
          if (shouldLog()) {
            console.error('[WebSocket] Error parsing message:', error);
          }
        }
      };

      ws.onerror = (error) => {
        if (shouldLog()) {
          console.error('[WebSocket] Connection error:', error);
        }
      };

      ws.onclose = () => {
        if (shouldLog()) {
          console.log('[WebSocket] Disconnected from server');
        }
        wsRef.current = null;

        // Attempt to reconnect after 3 seconds
        if (isSubscribed) {
          if (shouldLog()) {
            console.log('[WebSocket] Reconnecting in 3 seconds...');
          }
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      };
    };

    // Initial connection
    connect();

    // Cleanup on unmount
    return () => {
      isSubscribed = false;
      if (shouldLog()) {
        console.log('[WebSocket] Cleaning up connection');
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [onComplete]);

  return wsRef.current;
}
