import { useState, useEffect } from 'react';
import api from '../services/api';

export const useRFQs = () => {
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRFQs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/rfqs');
      setRfqs(res.data.data.rfqs);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch RFQs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRFQs();
  }, []);

  return { rfqs, loading, error, refresh: fetchRFQs };
};
