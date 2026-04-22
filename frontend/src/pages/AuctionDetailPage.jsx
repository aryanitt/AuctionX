import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { useCountdown } from '../hooks/useCountdown';
import { useBidSubmit } from '../hooks/useBidSubmit';
import { format } from 'date-fns';
import { Clock, ShieldAlert, Package, CheckCircle, ArrowLeft, Trophy, History, TrendingDown, Truck, Pencil, Trash2 } from 'lucide-react';

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-lg shadow-2xl relative">
        <h2 className="text-2xl font-bold text-white mb-6">Place Your Bid</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Carrier Name</label>
            <input type="text" name="carrierName" required className="input-field" value={formData.carrierName} onChange={handleChange} placeholder="e.g. Maersk" />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Freight (₹)</label>
              <input type="number" min="0" name="freightCharges" required className="input-field px-3" value={formData.freightCharges} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Origin (₹)</label>
              <input type="number" min="0" name="originCharges" required className="input-field px-3" value={formData.originCharges} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Dest. (₹)</label>
              <input type="number" min="0" name="destinationCharges" required className="input-field px-3" value={formData.destinationCharges} onChange={handleChange} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Transit Time (Days)</label>
              <input type="number" min="1" name="transitTime" required className="input-field" value={formData.transitTime} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Quote Valid Until</label>
              <input type="date" name="quoteValidityDate" required className="input-field" value={formData.quoteValidityDate} onChange={handleChange} />
            </div>
          </div>

          <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-between">
            <span className="text-emerald-400 font-medium">Estimated Total</span>
            <span className="text-2xl font-bold text-emerald-400">₹{total.toLocaleString()}</span>
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

  if (loading) return <div className="p-8 text-center text-slate-400">Loading auction details...</div>;
  if (error || !rfq) return <div className="p-8 text-center text-rose-400">{error}</div>;

  const isActive = rfq.status === 'active' && !isExpired;
  const isSupplier = user?.role === 'supplier';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-80px)] overflow-hidden flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <button 
          onClick={() => navigate('/auctions')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors flex-shrink-0 w-fit"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Auctions
        </button>

        {user?.role === 'buyer' && user?._id === rfq.buyer?._id && rfq.status === 'draft' && (
          <div className="flex gap-3">
            <button 
              onClick={() => navigate(`/auctions/${id}/edit`)}
              className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20"
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
              className="flex items-center gap-2 text-rose-400 hover:text-rose-300 transition-colors bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20"
            >
              <Trash2 className="h-4 w-4" /> Delete RFQ
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        
        {/* LEFT COLUMN - BIDS */}
        <div className="flex-1 flex flex-col glass rounded-xl overflow-hidden min-h-0">
          <div className="p-5 border-b border-slate-700/50 bg-slate-800/20 flex justify-between items-center">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-emerald-500" /> Live Leaderboard
            </h2>
            <span className="text-sm text-slate-400">{bids.length} Total Bids</span>
          </div>
          
          <div className="flex-1 overflow-auto">
            {bids.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <Truck className="h-12 w-12 mb-4 opacity-50" />
                <p>No bids have been placed yet.</p>
                {isActive && isSupplier && <p className="text-sm mt-1 text-emerald-400/80">Be the first to submit a quote!</p>}
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-navy-800/95 backdrop-blur-md z-10 border-b border-slate-700/50">
                  <tr>
                    <th className="p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Rank</th>
                    <th className="p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Supplier</th>
                    <th className="p-4 text-xs font-medium text-slate-400 uppercase tracking-wider text-right">Total Amount</th>
                    <th className="p-4 text-xs font-medium text-slate-400 uppercase tracking-wider text-right">Transit (Days)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {bids.map((bid) => (
                    <tr key={bid._id} className={`${bid.rank === 1 ? 'bg-emerald-500/10' : 'hover:bg-slate-800/30'} transition-colors`}>
                      <td className="p-4 font-medium">
                        {bid.rank === 1 ? (
                          <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 w-fit px-2 py-0.5 rounded border border-emerald-500/20">
                            <Trophy className="h-3.5 w-3.5" /> L1
                          </div>
                        ) : (
                          <span className="text-slate-400 ml-2">L{bid.rank}</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-slate-200">{bid.supplier.name}</div>
                        <div className="text-xs text-slate-500">{bid.carrierName}</div>
                      </td>
                      <td className="p-4 text-right">
                        <div className={`font-mono font-medium ${bid.rank === 1 ? 'text-emerald-400' : 'text-slate-200'}`}>
                          ₹{bid.totalAmount.toLocaleString()}
                        </div>
                      </td>
                      <td className="p-4 text-right text-slate-300">{bid.transitTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN - AUCTION DETAILS */}
        <div className="w-full lg:w-96 flex flex-col gap-6 flex-shrink-0 min-h-0 overflow-y-auto pr-1">
          
          {/* Card 1: Main Info */}
          <div className="glass-card flex flex-col items-center text-center">
            <div className={`w-full py-1.5 text-xs font-bold uppercase tracking-wider mb-4 rounded ${
              isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
              rfq.status === 'force_closed' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
              'bg-slate-500/20 text-slate-400 border border-slate-500/30'
            }`}>
              {isActive ? 'Live Bidding' : rfq.status.replace('_', ' ')}
            </div>
            
            <h1 className="text-2xl font-bold text-white leading-tight mb-2">{rfq.name}</h1>
            <div className="text-slate-400 font-mono text-sm mb-6 pb-6 border-b border-slate-700/50 w-full">{rfq.referenceId}</div>
            
            <div className="space-y-6 w-full">
              <div className="text-center">
                <p className="text-sm text-slate-400 mb-2 font-medium">
                  {rfq.status === 'draft' ? 'Bidding Starts In' : 'Time Remaining'}
                </p>
                {isActive || rfq.status === 'draft' ? (
                  <div className="text-4xl font-mono font-bold text-white flex justify-center gap-2">
                    <div className="bg-navy-900 rounded-lg p-3 border border-slate-700 shadow-inner min-w-[70px]">{hours}</div><span className="py-3 text-slate-500">:</span>
                    <div className="bg-navy-900 rounded-lg p-3 border border-slate-700 shadow-inner min-w-[70px]">{minutes}</div><span className="py-3 text-slate-500">:</span>
                    <div className="bg-navy-900 rounded-lg p-3 border border-slate-700 shadow-inner min-w-[70px] text-emerald-400">{seconds}</div>
                  </div>
                ) : (
                  <div className="text-2xl font-bold text-slate-500 py-3 bg-navy-900/50 rounded-lg border border-slate-800">Auction Ended</div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-3 w-full">
                <div className="bg-navy-900/40 border border-slate-700/50 rounded-lg p-3 text-left">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1"><Clock className="h-3 w-3" /> Start Time</div>
                  <div className="text-sm font-medium text-slate-200">{format(new Date(rfq.bidStartTime), 'MMM d, h:mm a')}</div>
                </div>
                <div className="bg-navy-900/40 border border-slate-700/50 rounded-lg p-3 text-left">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1"><Clock className="h-3 w-3" /> Current Close</div>
                  <div className="text-sm font-medium text-emerald-400">{format(new Date(rfq.bidCloseTime), 'MMM d, h:mm a')}</div>
                </div>
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-3 text-left">
                  <div className="text-[10px] text-rose-400/70 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Hard Stop</div>
                  <div className="text-sm font-medium text-rose-300">{format(new Date(rfq.forcedCloseTime), 'MMM d, h:mm a')}</div>
                </div>
                <div className="bg-navy-900/40 border border-slate-700/50 rounded-lg p-3 text-left">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1"><Package className="h-3 w-3" /> Pickup Date</div>
                  <div className="text-sm font-medium text-slate-200">{format(new Date(rfq.pickupDate), 'MMM d, yyyy')}</div>
                </div>
              </div>
            </div>

            {isActive && isSupplier && (
              <button 
                onClick={() => setIsModalOpen(true)}
                className="btn-primary w-full mt-6 py-3 text-lg font-bold"
              >
                Place Bid
              </button>
            )}
          </div>

          {/* Card 2: Configuration & Logs */}
          <div className="glass flex flex-col rounded-xl overflow-hidden min-h-0 flex-1">
            <div className="p-4 bg-slate-800/30 border-b border-slate-700/50 flex items-center gap-2">
              <History className="h-4 w-4 text-emerald-400" />
              <h3 className="font-semibold text-white">Auction Rules & History</h3>
            </div>
            
            <div className="p-4 border-b border-slate-700/50 bg-navy-900/30 text-sm">
              <div className="grid grid-cols-2 gap-2 text-slate-400 mb-2">
                <span>Trigger: <span className="text-white">{rfq.auctionConfig.triggerWindowMinutes}m</span></span>
                <span>Extension: <span className="text-white">+{rfq.auctionConfig.extensionDurationMinutes}m</span></span>
              </div>
              <p className="text-xs text-emerald-400/80 bg-emerald-500/10 p-2 rounded">
                Rule: {rfq.auctionConfig.extensionTrigger.split('_').join(' ').toUpperCase()}
              </p>
            </div>
            
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {rfq.extensionLogs.length === 0 ? (
                <p className="text-sm text-slate-500 italic text-center py-4">No extensions yet.</p>
              ) : (
                [...rfq.extensionLogs].reverse().map((log, i) => (
                  <div key={i} className="text-sm border-l-2 border-emerald-500 pl-3 py-1">
                    <div className="text-slate-300 mb-1">{log.triggerReason}</div>
                    <div className="text-xs text-slate-500 flex justify-between">
                      <span>{format(new Date(log.extendedAt), 'HH:mm:ss')}</span>
                      <span className="text-emerald-400">→ {format(new Date(log.newCloseTime), 'HH:mm')}</span>
                    </div>
                  </div>
                ))
              )}
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
