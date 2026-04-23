import { useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

/**
 * usePolling — polls GET /rfqs/:rfqId/bids every `interval` ms.
 *
 * Replaces the Socket.io useSocket hook for Vercel serverless compatibility.
 * On each tick it calls `onData({ bids, rfqStatus })` so the caller can
 * update its own state.
 *
 * @param {string|null} rfqId   - RFQ to poll. Polling is disabled when null.
 * @param {function}    onData  - Callback({ bids, rfqStatus }) called on each response.
 * @param {number}      interval - Poll interval in ms (default 3000).
 */
export const usePolling = (rfqId, onData, interval = 3000) => {
  const onDataRef = useRef(onData);
  onDataRef.current = onData;

  useEffect(() => {
    if (!rfqId) return;

    let active = true;

    const poll = async () => {
      try {
        const [bidsRes, rfqRes] = await Promise.all([
          api.get(`/rfqs/${rfqId}/bids`),
          api.get(`/rfqs/${rfqId}`),
        ]);
        if (!active) return;
        onDataRef.current({
          bids: bidsRes.data.data.bids,
          rfq: rfqRes.data.data.rfq,
        });
      } catch {
        // Silently ignore — next tick will retry
      }
    };

    const id = setInterval(poll, interval);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [rfqId, interval]);
};
