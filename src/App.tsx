import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AuthProvider } from '@/context/AuthContext';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { Categories } from '@/pages/Categories';
import { Products } from '@/pages/Products';
import { Orders } from '@/pages/Orders';
import { OrderDetail } from '@/pages/OrderDetail';
import { Vendors } from '@/pages/Vendors';
import { VendorDetail } from '@/pages/VendorDetail';
import { Drivers } from '@/pages/Drivers';
import { DriverDetail } from '@/pages/DriverDetail';
import { Customers } from '@/pages/Customers';
import { CustomerDetail } from '@/pages/CustomerDetail';
import { Offers } from '@/pages/Offers';
import { Settlements } from '@/pages/Settlements';
import { BankDetailsRequests } from '@/pages/BankDetailsRequests';
import { Analytics } from '@/pages/Analytics';
import { Notifications } from '@/pages/Notifications';
import { Support } from '@/pages/Support';
import { Settings } from '@/pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/products" element={<Products />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/:orderId" element={<OrderDetail />} />
              <Route path="/vendors" element={<Vendors />} />
              <Route path="/vendors/:vendorId" element={<VendorDetail />} />
              <Route path="/drivers" element={<Drivers />} />
              <Route path="/drivers/:driverId" element={<DriverDetail />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/:customerId" element={<CustomerDetail />} />
              <Route path="/offers" element={<Offers />} />
              <Route path="/settlements" element={<Settlements />} />
              <Route path="/bank-details-requests" element={<BankDetailsRequests />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/support" element={<Support />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
