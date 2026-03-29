import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import ProjectsPage from './pages/ProjectsPage';
import TimeEntriesPage from './pages/TimeEntriesPage';
import InvoicesPage from './pages/InvoicesPage';
import InvoiceDetailPage from './pages/InvoiceDetailPage';
import CreateInvoicePage from './pages/CreateInvoicePage';
import CreditsPage from './pages/CreditsPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import InvitesPage from './pages/InvitesPage';

const navItems = [
  { path: '/', label: 'Dashboard' },
  { path: '/clients', label: 'Clients' },
  { path: '/projects', label: 'Projects' },
  { path: '/time', label: 'Time Tracking' },
  { path: '/invoices', label: 'Invoices' },
  { path: '/credits', label: 'Credits' },
  { path: '/settings', label: 'Settings' },
];

export default function App() {
  const location = useLocation();
  const { user, isAdmin, logout } = useAuth();

  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  if (isAuthPage) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center space-x-2">
              <img src="/logo.png" alt="TimeForge" className="h-8 w-8" />
              <span className="text-xl font-bold text-indigo-600">TimeForge</span>
            </Link>
            <div className="flex items-center space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === item.path ||
                    (item.path !== '/' && location.pathname.startsWith(item.path))
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  to="/admin/invites"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname.startsWith('/admin')
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Invites
                </Link>
              )}
              {user && (
                <button onClick={logout}
                  className="ml-4 px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100">
                  Logout
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/time" element={<TimeEntriesPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/invoices/new" element={<CreateInvoicePage />} />
            <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
            <Route path="/credits" element={<CreditsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route element={<AdminRoute />}>
              <Route path="/admin/invites" element={<InvitesPage />} />
            </Route>
          </Route>
        </Routes>
      </main>
    </div>
  );
}
