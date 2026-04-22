import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { useCountdown } from '../hooks/useCountdown';
import { useBidSubmit } from '../hooks/useBidSubmit';
import { format } from 'date-fns';
import { Clock, ShieldAlert, Package, CheckCircle, ArrowLeft, Trophy, History, TrendingDown, Truck, Pencil, Trash2, Settings2 } from 'lucide-react';

const BidModal = ({ isOpen, onClose, onSubmit, isSubmitting }) => {
  const [formData, setFormData] = useState({
    carrierName: '',
    freightCharges: '',
    originCharges: '',
    destinationCharges: '',
    transitTime: '',
    quoteValidityDate: ''
  });

  const total = (Number(formData.freightCharges) || 0) + 
                (Number(formData.originCharges) || 0) + 
                (Number(formData.destinationCharges) || 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
      <div className="card-padded w-full max-w-lg shadow-2xl relative">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Place Your Bid</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Carrier Name</label>
            <input type="text" name="carrierName" required className="input-field" value={formData.carrierName} onChange={handleChange} placeholder="e.g. Maersk" />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Freight (₹)</label>
              <input type="number" min="0" name="freightCharges" required className="input-field" value={formData.freightCharges} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Origin (₹)</label>
              <input type="number" min="0" name="originCharges" required className="input-field" value={formData.originCharges} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Dest. (₹)</label>
              <input type="number" min="0" name="destinationCharges" required className="input-field" value={formData.destinationCharges} onChange={handleChange} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Transit Time (Days)</label>
              <input type="number" min="1" name="transitTime" required className="input-field" value={formData.transitTime} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Quote Valid Until</label>
              <input type="date" name="quoteValidityDate" required className="input-field" value={formData.quoteValidityDate} onChange={handleChange} />
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <span className="text-blue-800 font-semibold">Estimated Total</span>
            <span className="text-2xl font-bold text-blue-700">₹{total.toLocaleString()}</span>
          </div>

          <div className="pt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="btn-primary min-w-[120px]" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Bid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


export const AuctionDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  
  const [rfq, setRfq] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { submitBid, loading: isSubmitting, error: submitError } = useBidSubmit();
  
  const socket = useSocket(id);
  
  // Real-time variables
  const [currentCloseTime, setCurrentCloseTime] = useState(null);
  const { hours, minutes, seconds, isExpired } = useCountdown(currentCloseTime);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get(`/rfqs/${id}`);
        const fetchedRfq = res.data.data.rfq;
        setRfq(fetchedRfq);
        setBids(res.data.data.bids);
        
        // If draft, countdown to start time. Otherwise, countdown to close time.
        if (fetchedRfq.status === 'draft') {
          setCurrentCloseTime(fetchedRfq.bidStartTime);
        } else {
          setCurrentCloseTime(fetchedRfq.bidCloseTime);
        }
      } catch (err) {
        setError('Failed to load auction details');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;
    
    socket.on('bid_update', (data) => {
      setBids(data.bids);
      if (data.newBidCloseTime) setCurrentCloseTime(data.newBidCloseTime);
      if (data.extensionLog) {
        setRfq(prev => ({ 
          ...prev, 
          extensionLogs: [...prev.extensionLogs, data.extensionLog],
          bidCloseTime: data.newBidCloseTime
        }));
      }
    });

    socket.on('auction_closed', () => {
      setRfq(prev => ({ ...prev, status: 'closed' }));
    });
    
    socket.on('auction_force_closed', () => {
      setRfq(prev => ({ ...prev, status: 'force_closed' }));
    });

    return () => {
      socket.off('bid_update');
      socket.off('auction_closed');
      socket.off('auction_force_closed');
    };
  }, [socket]);

  const handleBidSubmit = async (formData) => {
    const res = await submitBid(id, formData);
    if (res.success) {
      setIsModalOpen(false);
      // Let socket handle updating the list
    } else {
      alert(res.error); // Show error to user
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500 font-medium">Loading auction details...</div>;
  if (error || !rfq) return <div className="p-8 text-center text-red-500 font-medium">{error}</div>;

  const isActive = rfq.status === 'active' && !isExpired;
  const isSupplier = user?.role === 'supplier';
  const lowestBid = bids.length > 0 ? bids[0] : null;

  return (
    <div className="max-w-screen-2xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 h-[calc(100vh-64px)] overflow-hidden flex flex-col bg-gray-50">
      <div className="flex justify-between items-center mb-6">
        <button 
          onClick={() => navigate('/auctions')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-medium transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Auctions
        </button>

        {user?.role === 'buyer' && user?._id === rfq.buyer?._id && rfq.status === 'draft' && (
          <div className="flex gap-3">
            <button 
              onClick={() => navigate(`/auctions/${id}/edit`)}
              className="btn-secondary flex items-center gap-2"
            >
              <Pencil className="h-4 w-4" /> Edit RFQ
            </button>
            <button 
              onClick={async () => {
                if (window.confirm('Are you sure you want to delete this RFQ?')) {
                  try {
                    await api.delete(`/rfqs/${id}`);
                    navigate('/auctions');
                  } catch (err) {
                    alert(err.response?.data?.error || 'Failed to delete RFQ');
                  }
                }
              }}
              className="btn-danger flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" /> Delete RFQ
            </button>
          </div>
        )}
      </div>

      {/* DASHBOARD HEADER - Important Info at the top */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        
        {/* Title Card */}
        <div className="card p-5 lg:col-span-2 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">{rfq.name}</h1>
              <span className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-md ${
                isActive ? 'bg-emerald-100 text-emerald-800' : 
                rfq.status === 'force_closed' ? 'bg-red-100 text-red-800' :
                rfq.status === 'draft' ? 'bg-amber-100 text-amber-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {isActive ? 'Live Bidding' : rfq.status.replace('_', ' ')}
              </span>
            </div>
            <div className="text-gray-500 font-mono text-sm">{rfq.referenceId}</div>
            <div className="text-gray-500 text-sm mt-3 flex items-center gap-1.5 font-medium">
              <Package className="h-4 w-4" /> Pickup: {format(new Date(rfq.pickupDate), 'MMM d, yyyy')}
            </div>
          </div>
          {isActive && isSupplier && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="btn-primary py-3 px-6 text-base shadow-md shadow-blue-500/20"
            >
              Place Bid
            </button>
          )}
        </div>

        {/* Timer Card */}
        <div className="card p-5 flex flex-col justify-center bg-white border-blue-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            {rfq.status === 'draft' ? 'Bidding Starts In' : 'Time Remaining'}
          </p>
          {isActive || rfq.status === 'draft' ? (
            <div className="text-4xl font-mono font-bold text-gray-900 flex items-center gap-2">
              <div className="text-blue-700">{hours}</div><span className="text-gray-300 pb-1">:</span>
              <div className="text-blue-700">{minutes}</div><span className="text-gray-300 pb-1">:</span>
              <div className="text-blue-700">{seconds}</div>
            </div>
          ) : (
            <div className="text-2xl font-bold text-gray-400">Auction Ended</div>
          )}
          <p className="text-xs text-gray-500 mt-2 font-medium">Closes: {format(new Date(rfq.bidCloseTime), 'h:mm a')}</p>
        </div>

        {/* Lowest Bid Card */}
        <div className="card p-5 flex flex-col justify-center bg-emerald-50/50 border-emerald-100">
          <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Trophy className="h-4 w-4" /> Current Lowest Bid
          </p>
          {lowestBid ? (
            <>
              <div className="text-4xl font-mono font-bold text-emerald-700">₹{lowestBid.totalAmount.toLocaleString()}</div>
              <p className="text-xs text-emerald-700 font-medium mt-2">By {lowestBid.supplier.name}</p>
            </>
          ) : (
            <div className="text-xl font-semibold text-gray-400 mt-2">No bids yet</div>
          )}
        </div>

      </div>

      {/* TWO COLUMNS: LEADERBOARD & DETAILS */}
      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        
        {/* LEFT COLUMN - LEADERBOARD */}
        <div className="flex-1 flex flex-col card overflow-hidden min-h-0">
          <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-blue-600" /> Live Leaderboard
            </h2>
            <span className="text-sm font-semibold text-gray-500 bg-white px-2 py-1 rounded-md border border-gray-200 shadow-sm">{bids.length} Bids</span>
          </div>
          
          <div className="flex-1 overflow-auto bg-white">
            {bids.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <Truck className="h-12 w-12 mb-4 text-gray-300" />
                <p className="font-medium text-gray-500">No bids have been placed yet.</p>
                {isActive && isSupplier && <p className="text-sm mt-1 text-blue-600 font-medium">Be the first to submit a quote!</p>}
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white shadow-sm z-10 border-b border-gray-200">
                  <tr>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50/80 backdrop-blur-sm">Rank</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50/80 backdrop-blur-sm">Supplier</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right bg-gray-50/80 backdrop-blur-sm">Total Amount</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right bg-gray-50/80 backdrop-blur-sm">Transit (Days)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bids.map((bid) => (
                    <tr key={bid._id} className={`${bid.rank === 1 ? 'bg-emerald-50' : 'hover:bg-gray-50'} transition-colors`}>
                      <td className="p-4 font-bold">
                        {bid.rank === 1 ? (
                          <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-100 w-fit px-2.5 py-1 rounded-md border border-emerald-200">
                            <Trophy className="h-3.5 w-3.5" /> L1
                          </div>
                        ) : (
                          <span className="text-gray-500 ml-2">L{bid.rank}</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-gray-900">{bid.supplier.name}</div>
                        <div className="text-xs font-medium text-gray-500 mt-0.5">{bid.carrierName}</div>
                      </td>
                      <td className="p-4 text-right">
                        <div className={`font-mono font-bold text-base ${bid.rank === 1 ? 'text-emerald-700' : 'text-gray-900'}`}>
                          ₹{bid.totalAmount.toLocaleString()}
                        </div>
                      </td>
                      <td className="p-4 text-right font-medium text-gray-600">{bid.transitTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN - AUCTION RULES & HISTORY */}
        <div className="w-full lg:w-96 flex flex-col gap-6 flex-shrink-0 min-h-0">
          
          <div className="card flex flex-col overflow-hidden min-h-0 flex-1">
            <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-gray-600" />
              <h3 className="font-bold text-gray-900">Auction Rules & History</h3>
            </div>
            
            <div className="p-5 border-b border-gray-200 bg-white">
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Trigger</span>
                  <span className="font-bold text-gray-900">{rfq.auctionConfig.triggerWindowMinutes}m Window</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Extension</span>
                  <span className="font-bold text-blue-600">+{rfq.auctionConfig.extensionDurationMinutes}m</span>
                </div>
              </div>
              <div className="text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-100 p-3 rounded-lg flex flex-col gap-1">
                <span className="uppercase text-[10px] text-blue-600 tracking-wider">Rule</span>
                {rfq.auctionConfig.extensionTrigger.split('_').join(' ').toUpperCase()}
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-5 bg-white">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <History className="h-4 w-4" /> Activity Log
              </h4>
              <div className="space-y-4">
                {rfq.extensionLogs.length === 0 ? (
                  <p className="text-sm font-medium text-gray-400 italic text-center py-8">No extensions yet.</p>
                ) : (
                  [...rfq.extensionLogs].reverse().map((log, i) => (
                    <div key={i} className="text-sm border-l-2 border-blue-500 pl-4 py-1">
                      <div className="font-semibold text-gray-900 mb-1">{log.triggerReason}</div>
                      <div className="text-xs font-medium text-gray-500 flex justify-between">
                        <span>{format(new Date(log.extendedAt), 'HH:mm:ss')}</span>
                        <span className="text-blue-600">Extended to {format(new Date(log.newCloseTime), 'HH:mm')}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      <BidModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleBidSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};
