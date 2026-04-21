import { useState } from 'react';
import api from '../services/api';

export const useBidSubmit = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submitBid = async (rfqId, bidData) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/rfqs/${rfqId}/bids`, bidData);
      setLoading(false);
      return { success: true, data: res.data.data };
    } catch (err) {
      setLoading(false);
      const errMsg = err.response?.data?.error || 'Failed to submit bid';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  return { submitBid, loading, error };
};
