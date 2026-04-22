import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { Settings2, ArrowLeft, Info, Trash2 } from 'lucide-react';

export const EditRFQPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    bidStartTime: '',
    bidCloseTime: '',
    forcedCloseTime: '',
    pickupDate: '',
    auctionConfig: {
      triggerWindowMinutes: 10,
      extensionDurationMinutes: 5,
      extensionTrigger: 'l1_rank_change'
    }
  });

  useEffect(() => {
    const fetchRFQ = async () => {
      try {
        const res = await api.get(`/rfqs/${id}`);
        const data = res.data.data.rfq;
        
        // Format dates for datetime-local input
        const formatDate = (dateString) => {
          if (!dateString) return '';
          const d = new Date(dateString);
          return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        };
        const formatJustDate = (dateString) => {
          if (!dateString) return '';
          return new Date(dateString).toISOString().split('T')[0];
        };

        setFormData({
          name: data.name,
          bidStartTime: formatDate(data.bidStartTime),
          bidCloseTime: formatDate(data.bidCloseTime),
          forcedCloseTime: formatDate(data.forcedCloseTime),
          pickupDate: formatJustDate(data.pickupDate),
          auctionConfig: data.auctionConfig
        });
        setLoading(false);
      } catch (err) {
        setError('Failed to load RFQ data');
        setLoading(false);
      }
    };
    fetchRFQ();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('config_')) {
      const field = name.replace('config_', '');
      setFormData(prev => ({
        ...prev,
        auctionConfig: {
          ...prev.auctionConfig,
          [field]: field === 'extensionTrigger' ? value : Number(value)
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const start = new Date(formData.bidStartTime);
    const close = new Date(formData.bidCloseTime);
    const force = new Date(formData.forcedCloseTime);

    if (isNaN(start.getTime()) || isNaN(close.getTime()) || isNaN(force.getTime())) {
      setError('Please fill in all date/time fields with valid values');
      return;
    }

    if (start >= close) {
      setError('Bid Start Time must be before Bid Close Time');
      return;
    }
    if (force <= close) {
      setError('Forced Close Time must be uniquely AFTER Bid Close Time');
      return;
    }

    setSubmitting(true);
    try {
      // Convert datetime-local strings to proper ISO-8601 with timezone
      const payload = {
        ...formData,
        bidStartTime: new Date(formData.bidStartTime).toISOString(),
        bidCloseTime: new Date(formData.bidCloseTime).toISOString(),
        forcedCloseTime: new Date(formData.forcedCloseTime).toISOString(),
        pickupDate: new Date(formData.pickupDate).toISOString(),
      };
      await api.put(`/rfqs/${id}`, payload);
      navigate(`/auctions/${id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update RFQ');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500 font-medium">Loading RFQ data...</div>;

  return (
    <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
      <button 
        onClick={() => navigate(`/auctions/${id}`)}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-medium mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Auction
      </button>

      <div className="card-padded">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-6">Modify RFQ</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-8 text-sm font-medium flex items-center gap-2">
            <Info className="h-5 w-5" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-10">
          
          {/* Section: Basic Details */}
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2">Basic Details</h2>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">RFQ Name / Description</label>
              <input
                type="text"
                name="name"
                required
                className="input-field"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Bid Start Time</label>
                <input
                  type="datetime-local"
                  name="bidStartTime"
                  required
                  className="input-field"
                  value={formData.bidStartTime}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Bid Close Time</label>
                <input
                  type="datetime-local"
                  name="bidCloseTime"
                  required
                  className="input-field"
                  value={formData.bidCloseTime}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Forced Bid Close Time <span className="text-red-500 ml-1 text-xs font-bold uppercase">(Hard Limit)</span>
                </label>
                <input
                  type="datetime-local"
                  name="forcedCloseTime"
                  required
                  className="input-field border-red-200 focus:border-red-500 focus:ring-red-500/30"
                  value={formData.forcedCloseTime}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Pickup / Service Date</label>
                <input
                  type="date"
                  name="pickupDate"
                  required
                  className="input-field"
                  value={formData.pickupDate}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* Section: Auction Configuration */}
          <div className="space-y-5 bg-gray-50 p-6 rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 mb-2 border-b border-gray-200 pb-3">
              <Settings2 className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold text-gray-900">Auction Configuration</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Trigger Window (Minutes)</label>
                <div className="relative">
                  <input
                    type="number"
                    name="config_triggerWindowMinutes"
                    min="1"
                    required
                    className="input-field pr-12"
                    value={formData.auctionConfig.triggerWindowMinutes}
                    onChange={handleChange}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">min</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Extension Duration (Minutes)</label>
                <div className="relative">
                  <input
                    type="number"
                    name="config_extensionDurationMinutes"
                    min="1"
                    required
                    className="input-field pr-12"
                    value={formData.auctionConfig.extensionDurationMinutes}
                    onChange={handleChange}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">min</span>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <label className="block text-sm font-semibold text-gray-700 mb-4">Extension Trigger Condition</label>
              <div className="space-y-4">
                {[
                  { id: 'bid_received', label: 'Bid Received', desc: 'Extend whenever any bid is placed in the window' },
                  { id: 'any_rank_change', label: 'Any Rank Change', desc: 'Extend if any supplier changes position' },
                  { id: 'l1_rank_change', label: 'L1 Rank Change', desc: 'Extend ONLY when the lowest bidder (L1) changes' }
                ].map(trigger => (
                  <label key={trigger.id} className="flex items-start gap-3 cursor-pointer group bg-white p-3 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                    <div className="flex items-center h-5">
                      <input
                        type="radio"
                        name="config_extensionTrigger"
                        value={trigger.id}
                        checked={formData.auctionConfig.extensionTrigger === trigger.id}
                        onChange={handleChange}
                        className="w-4 h-4 text-blue-600 bg-white border-gray-300 focus:ring-blue-600 focus:ring-2 cursor-pointer mt-0.5"
                      />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{trigger.label}</div>
                      <div className="text-xs font-medium text-gray-500 mt-0.5">{trigger.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-200 flex justify-between gap-4 items-center">
            <button
              type="button"
              onClick={async () => {
                if (window.confirm('Are you sure you want to delete this RFQ? This action cannot be undone.')) {
                  try {
                    setSubmitting(true);
                    await api.delete(`/rfqs/${id}`);
                    navigate('/auctions');
                  } catch (err) {
                    setError(err.response?.data?.error || 'Failed to delete RFQ');
                    setSubmitting(false);
                  }
                }
              }}
              className="btn-danger flex items-center gap-2"
              disabled={submitting}
            >
              <Trash2 className="h-4 w-4" /> Delete RFQ
            </button>
            <div className="flex gap-4">
              <button 
                type="button" 
                onClick={() => navigate(`/auctions/${id}`)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={submitting}
                className="btn-primary min-w-[140px] shadow-md shadow-blue-500/20 py-3"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
