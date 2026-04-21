import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Settings2, ArrowLeft } from 'lucide-react';

export const CreateRFQPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
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

    // Client-side validations
    const start = new Date(formData.bidStartTime);
    const close = new Date(formData.bidCloseTime);
    const force = new Date(formData.forcedCloseTime);

    if (start >= close) {
      setError('Bid Start Time must be before Bid Close Time');
      return;
    }
    if (force <= close) {
      setError('Forced Close Time must be uniquely AFTER Bid Close Time');
      return;
    }

    setLoading(true);
    try {
      await api.post('/rfqs', formData);
      navigate('/auctions');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create RFQ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button 
        onClick={() => navigate('/auctions')}
        className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Auctions
      </button>

      <div className="glass-card">
        <h1 className="text-2xl font-bold text-white mb-6">Create New RFQ</h1>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/50 text-rose-400 p-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-emerald-400 border-b border-slate-700 pb-2">Basic Details</h2>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">RFQ Name / Description</label>
              <input
                type="text"
                name="name"
                required
                className="input-field"
                placeholder="e.g. 20ft Container Mumbai to Dubai"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Bid Start Time</label>
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
                <label className="block text-sm font-medium text-slate-300 mb-1">Bid Close Time</label>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Forced Bid Close Time <span className="text-rose-400 ml-1 text-xs">(Hard Limit)</span></label>
                <input
                  type="datetime-local"
                  name="forcedCloseTime"
                  required
                  className="input-field border-rose-500/30 focus:border-rose-500 focus:ring-rose-500/50"
                  value={formData.forcedCloseTime}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Pickup / Service Date</label>
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

          <div className="space-y-4 bg-slate-800/30 p-5 rounded-lg border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <Settings2 className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Auction Configuration</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Trigger Window (Minutes)</label>
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
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">min</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Check for triggers in last X min</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Extension Duration (Minutes)</label>
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
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">min</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Add +Y min to close time if triggered</p>
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-sm font-medium text-slate-300 mb-3">Extension Trigger Condition</label>
              <div className="space-y-3">
                {[
                  { id: 'bid_received', label: 'Bid Received', desc: 'Extend whenever any bid is placed in the window' },
                  { id: 'any_rank_change', label: 'Any Rank Change', desc: 'Extend if any supplier changes position' },
                  { id: 'l1_rank_change', label: 'L1 Rank Change', desc: 'Extend ONLY when the lowest bidder (L1) changes' }
                ].map(trigger => (
                  <label key={trigger.id} className="flex items-start gap-3 cursor-pointer group">
                    <div className="flex items-center h-5">
                      <input
                        type="radio"
                        name="config_extensionTrigger"
                        value={trigger.id}
                        checked={formData.auctionConfig.extensionTrigger === trigger.id}
                        onChange={handleChange}
                        className="w-4 h-4 text-emerald-500 bg-navy-900 border-slate-600 focus:ring-emerald-500 focus:ring-2 cursor-pointer mt-0.5"
                      />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-200 group-hover:text-emerald-400 transition-colors">{trigger.label}</div>
                      <div className="text-xs text-slate-500">{trigger.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-700/50 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={() => navigate('/auctions')}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="btn-primary min-w-[140px]"
            >
              {loading ? 'Creating...' : 'Publish RFQ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
