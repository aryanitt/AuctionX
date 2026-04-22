import { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Package, Mail, Lock, User, Truck, Briefcase } from 'lucide-react';

export const RegisterPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'supplier'
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    
    const res = await register(formData);
    if (res.success) {
      navigate('/auctions');
    } else {
      setError(res.error);
    }
    
    setIsSubmitting(false);
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-gray-50 py-10">
      <div className="card-padded w-full max-w-md shadow-lg">
        <div className="text-center mb-8">
          <div className="mx-auto bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border border-blue-100 shadow-sm">
            <Package className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">Create Account</h2>
          <p className="text-gray-500 font-medium">Join the BritAuction platform</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-6 text-sm text-center font-medium shadow-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                name="name"
                required
                className="input-field pl-10"
                placeholder="John Doe"
                value={formData.name}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                name="email"
                required
                className="input-field pl-10"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                name="password"
                required
                minLength={6}
                className="input-field pl-10"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">I am a...</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, role: 'supplier' }))}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                  formData.role === 'supplier'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Truck className={`h-6 w-6 mb-1 ${formData.role === 'supplier' ? 'text-blue-600' : 'text-gray-400'}`} />
                <span className="font-semibold text-sm">Supplier/Carrier</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, role: 'buyer' }))}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                  formData.role === 'buyer'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Briefcase className={`h-6 w-6 mb-1 ${formData.role === 'buyer' ? 'text-blue-600' : 'text-gray-400'}`} />
                <span className="font-semibold text-sm">Buyer</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full mt-6 py-3 shadow-md shadow-blue-500/20 text-base"
          >
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-8 text-center text-gray-500 text-sm font-medium">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:text-blue-700 hover:underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
