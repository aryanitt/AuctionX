import { useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useRFQs } from '../hooks/useRFQs';
import { format } from 'date-fns';
import { io } from 'socket.io-client';
import { Package, Clock, ShieldAlert, CheckCircle, ChevronRight, Hash, Trash2 } from 'lucide-react';
import api from '../services/api';

const SOCKET_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000';

const StatusBadge = ({ status }) => {
  switch (status) {
    case 'active':
      return <span className="badge-active"><CheckCircle className="h-3 w-3" /> Active</span>;
    case 'closed':
      return <span className="badge-closed"><Clock className="h-3 w-3" /> Closed</span>;
    case 'force_closed':
      return <span className="badge-force-closed"><ShieldAlert className="h-3 w-3" /> Force Closed</span>;
    default:
      return <span className="badge-draft">Draft</span>;
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

  if (loading) return <div className="p-8 text-center text-gray-500 font-medium">Loading auctions...</div>;
  if (error) return <div className="p-8 text-center text-red-500 font-medium">Error: {error}</div>;

  return (
    <div className="max-w-screen-2xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">Active Auctions</h1>
          <p className="text-gray-500 font-medium">Browse and participate in live freight bids</p>
        </div>
        {user?.role === 'buyer' && (
          <Link to="/auctions/create" className="btn-primary">
            Create RFQ
          </Link>
        )}
      </div>

      <div className="card overflow-hidden flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">RFQ Details</th>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reference ID</th>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">End Time</th>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lowest Bid (L1)</th>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rfqs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-500 font-medium">No auctions found.</td>
                </tr>
              ) : (
                rfqs.map((rfq) => (
                  <tr 
                    key={rfq._id} 
                    onClick={() => navigate(`/auctions/${rfq._id}`)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer group"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-50 p-2 rounded-lg border border-blue-100">
                          <Package className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 mb-0.5 group-hover:text-blue-600 transition-colors">{rfq.name}</div>
                          <div className="text-xs text-gray-500 font-medium">By {rfq.buyer.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1.5 font-mono font-medium">
                        <Hash className="h-3.5 w-3.5 text-gray-400" />
                        {rfq.referenceId}
                      </div>
                    </td>
                    <td className="p-4 text-sm">
                      <div className="text-gray-900 font-medium">{format(new Date(rfq.bidCloseTime), 'MMM d, h:mm a')}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Hard limit: {format(new Date(rfq.forcedCloseTime), 'h:mm a')}</div>
                    </td>
                    <td className="p-4">
                      {rfq.lowestBid ? (
                        <div>
                          <div className="font-mono text-emerald-600 font-bold text-base">₹{rfq.lowestBid.totalAmount.toLocaleString()}</div>
                          <div className="text-xs text-gray-500 font-medium">{rfq.lowestBid.transitTime} days transit</div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm italic font-medium">No bids yet</span>
                      )}
                    </td>
                    <td className="p-4">
                      <StatusBadge status={rfq.status} />
                    </td>
                    <td className="p-4 text-right flex items-center justify-end gap-2">
                      {user?.role === 'buyer' && user?._id === rfq.buyer?._id && rfq.status === 'draft' && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/auctions/${rfq._id}/edit`);
                            }}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 text-xs font-semibold transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (window.confirm('Are you sure you want to delete this RFQ?')) {
                                try {
                                  await api.delete(`/rfqs/${rfq._id}`);
                                  refresh();
                                } catch (err) {
                                  alert(err.response?.data?.error || 'Failed to delete RFQ');
                                }
                              }
                            }}
                            className="mr-3 text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-semibold transition-colors flex items-center gap-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </>
                      )}
                      <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors inline-block" />
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
