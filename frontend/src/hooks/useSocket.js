import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000';

export const useSocket = (rfqId) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Connect to server
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    // Join room if rfqId is provided
    if (rfqId) {
      newSocket.emit('join_rfq', rfqId);
    }

    return () => {
      if (rfqId) {
        newSocket.emit('leave_rfq', rfqId);
      }
      newSocket.disconnect();
    };
  }, [rfqId]);

  return socket;
};
