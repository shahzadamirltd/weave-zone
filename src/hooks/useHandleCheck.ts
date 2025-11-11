import { useEffect, useState, useRef } from 'react';

interface HandleCheckResult {
  available: boolean;
  message?: string;
  error?: string;
  checking: boolean;
}

export const useHandleCheck = (handle: string, debounceMs: number = 500) => {
  const [result, setResult] = useState<HandleCheckResult>({
    available: false,
    checking: false,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Connect WebSocket
    const ws = new WebSocket('wss://zsksielzhfezferouztf.supabase.co/functions/v1/check-handle');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Handle checker WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received:', data);

        if (data.type === 'handle_response') {
          setResult({
            available: data.available,
            message: data.message,
            error: data.error,
            checking: false,
          });
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setResult({
        available: false,
        error: 'Connection error',
        checking: false,
      });
    };

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      ws.close();
    };
  }, []);

  useEffect(() => {
    if (!handle || handle.length < 3) {
      setResult({ available: false, checking: false });
      return;
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setResult((prev) => ({ ...prev, checking: true }));

    // Debounce the check
    timeoutRef.current = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'check_handle',
          handle: handle.trim().toLowerCase(),
        }));
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handle, debounceMs]);

  return result;
};