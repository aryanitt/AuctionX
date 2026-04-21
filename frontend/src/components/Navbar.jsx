import { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LogOut, Plus, Package } from 'lucide-react';

export const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="glass sticky top-0 z-50 border-b-0 border-slate-700/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0 flex items-center gap-2">
            <Package className="h-8 w-8 text-emerald-500" />
            <Link to="/auctions" className="text-xl font-bold text-white tracking-tight">
              Brit<span className="text-emerald-500">Auction</span>
            </Link>
          </div>
          
          {user && (
            <div className="flex items-center gap-3 sm:gap-6">
              {user.role === 'buyer' && (
                <Link to="/auctions/create" className="btn-primary text-sm py-1.5 px-3 whitespace-nowrap">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Create RFQ</span>
                </Link>
              )}

              <div className="flex items-center gap-4 border-l border-slate-700/50 pl-4 sm:pl-6">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-sm font-bold text-slate-200 tracking-wide">{user.name}</span>
                  <span className="text-[10px] uppercase tracking-wider text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-400/10 border border-emerald-400/20 mt-0.5">
                    {user.role}
                  </span>
                </div>

                <button 
                  onClick={handleLogout}
                  className="bg-slate-800/50 hover:bg-rose-500/10 border border-slate-700/50 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 rounded-lg p-2 transition-all flex items-center justify-center group"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
