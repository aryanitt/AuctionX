import { useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useRFQs } from '../hooks/useRFQs';
import { format } from 'date-fns';
import { io } from 'socket.io-client';
import { Package, Clock, ShieldAlert, CheckCircle, ChevronRight, Hash } from 'lucide-react';

const SOCKET_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000';

const StatusBadge = ({ status }) => {
  switch (status) {
    case 'active':
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle className="h-3 w-3" /> Active</span>;
    case 'closed':
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20"><Clock className="h-3 w-3" /> Closed</span>;
    case 'force_closed':
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20"><ShieldAlert className="h-3 w-3" /> Force Closed</span>;
    default:
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Draft</span>;
  }
};

export const AuctionListPage = () => {
  const { user } = useContext(AuthContext);
  const { rfqs, loading, error, refresh } = useRFQs();
  const navigate = useNavigate();

  useEffect(() => {
    const socket = io(SOCKET_URL);
    
    // Refresh the list when we get updates
    socket.on('bid_update', refresh);
    socket.on('auction_extended', refresh);
    socket.on('auction_closed', refresh);
    socket.on('auction_force_closed', refresh);

    return () => {
      socket.disconnect();
    };
  }, [refresh]);

  if (loading) return <div className="p-8 text-center text-slate-400">Loading auctions...</div>;
  if (error) return <div className="p-8 text-center text-rose-400">Error: {error}</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Active Auctions</h1>
          <p className="text-slate-400">Browse and participate in live freight bids</p>
        </div>
        {user?.role === 'buyer' && (
          <Link to="/auctions/create" className="btn-primary">
            + Create RFQ
          </Link>
        )}
      </div>

      <div className="glass overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800/20">
                <th className="p-4 text-sm font-medium text-slate-300">RFQ Details</th>
                <th className="p-4 text-sm font-medium text-slate-300">Reference ID</th>
                <th className="p-4 text-sm font-medium text-slate-300">End Time</th>
                <th className="p-4 text-sm font-medium text-slate-300">Lowest Bid (L1)</th>
                <th className="p-4 text-sm font-medium text-slate-300">Status</th>
                <th className="p-4 text-sm font-medium text-slate-300"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {rfqs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-400">No auctions found.</td>
                </tr>
              ) : (
                rfqs.map((rfq) => (
                  <tr 
                    key={rfq._id} 
                    onClick={() => navigate(`/auctions/${rfq._id}`)}
                    className="hover:bg-slate-800/30 transition-colors cursor-pointer group"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                          <Package className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                          <div className="font-medium text-white mb-0.5 group-hover:text-emerald-400 transition-colors">{rfq.name}</div>
                          <div className="text-xs text-slate-400">By {rfq.buyer.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-300">
                      <div className="flex items-center gap-1.5 font-mono">
                        <Hash className="h-3.5 w-3.5 text-slate-500" />
                        {rfq.referenceId}
                      </div>
                    </td>
                    <td className="p-4 text-sm">
                      <div className="text-slate-200">{format(new Date(rfq.bidCloseTime), 'MMM d, h:mm a')}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Hard limit: {format(new Date(rfq.forcedCloseTime), 'h:mm a')}</div>
                    </td>
                    <td className="p-4">
                      {rfq.lowestBid ? (
                        <div>
                          <div className="font-mono text-emerald-400 font-medium">₹{rfq.lowestBid.totalAmount.toLocaleString()}</div>
                          <div className="text-xs text-slate-400">{rfq.lowestBid.transitTime} days transit</div>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-sm italic">No bids yet</span>
                      )}
                    </td>
                    <td className="p-4">
                      <StatusBadge status={rfq.status} />
                    </td>
                    <td className="p-4 text-right">
                      <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-emerald-400 transition-colors inline-block" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
