import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute, BuyerRoute } from './components/ProtectedRoute';

import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AuctionListPage } from './pages/AuctionListPage';
import { CreateRFQPage } from './pages/CreateRFQPage';
import { EditRFQPage } from './pages/EditRFQPage';
import { AuctionDetailPage } from './pages/AuctionDetailPage';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="flex flex-col min-h-screen bg-navy-900">
          <Navbar />
          <Routes>
            <Route path="/" element={<Navigate to="/auctions" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            
            <Route 
              path="/auctions" 
              element={
                <ProtectedRoute>
                  <AuctionListPage />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/auctions/create" 
              element={
                <BuyerRoute>
                  <CreateRFQPage />
                </BuyerRoute>
              } 
            />
            
            <Route 
              path="/auctions/:id" 
              element={
                <ProtectedRoute>
                  <AuctionDetailPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/auctions/:id/edit" 
              element={
                <BuyerRoute>
                  <EditRFQPage />
                </BuyerRoute>
              } 
            />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
