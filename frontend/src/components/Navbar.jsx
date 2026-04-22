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
    <nav className="bg-white sticky top-0 z-50 border-b border-gray-200 shadow-sm">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0 flex items-center gap-2">
            <div className="bg-blue-50 p-1.5 rounded-lg border border-blue-100">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <Link to="/auctions" className="text-xl font-extrabold text-gray-900 tracking-tight">
              Brit<span className="text-blue-600">Auction</span>
            </Link>
          </div>
          
          {user && (
            <div className="flex items-center gap-3 sm:gap-6">
              {user.role === 'buyer' && (
                <Link to="/auctions/create" className="btn-primary text-sm py-2 px-4 whitespace-nowrap shadow-sm">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Create RFQ</span>
                </Link>
              )}

              <div className="flex items-center gap-4 border-l border-gray-200 pl-4 sm:pl-6">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-sm font-semibold text-gray-900 tracking-wide">{user.name}</span>
                  <span className="text-[10px] uppercase font-medium tracking-wider text-blue-700 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 mt-0.5">
                    {user.role}
                  </span>
                </div>

                <button 
                  onClick={handleLogout}
                  className="bg-white hover:bg-red-50 border border-gray-200 hover:border-red-200 text-gray-500 hover:text-red-600 rounded-lg p-2 transition-colors flex items-center justify-center group"
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
