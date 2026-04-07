import { useState, useEffect } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { ProtectedRoute, AdminRoute } from "./components/ProtectedRoute";
import DashboardPage from "./pages/DashboardPage";
import ClientsPage from "./pages/ClientsPage";
import ProjectsPage from "./pages/ProjectsPage";
import TimeEntriesPage from "./pages/TimeEntriesPage";
import InvoicesPage from "./pages/InvoicesPage";
import InvoiceDetailPage from "./pages/InvoiceDetailPage";
import CreateInvoicePage from "./pages/CreateInvoicePage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ImportPage from "./pages/ImportPage";
import InvitesPage from "./pages/InvitesPage";

interface NavItem {
  path: string;
  label: string;
  children?: NavItem[];
  adminOnly?: boolean;
}

function SidebarAccordion({
  item,
  location,
}: {
  item: NavItem;
  location: ReturnType<typeof useLocation>;
}) {
  const allLinks = item.children ?? [];

  const isActive =
    location.pathname === item.path ||
    (item.path !== "/" && location.pathname.startsWith(item.path)) ||
    item.children?.some(
      (c) =>
        location.pathname === c.path || location.pathname.startsWith(c.path),
    );

  const [open, setOpen] = useState(!!isActive);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer select-none ${
          isActive
            ? "text-indigo-700"
            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
        }`}
      >
        <span>{item.label}</span>
        <svg
          className={`w-3 h-3 opacity-50 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      <div
        className={`grid transition-all duration-200 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="mt-0.5 ml-2 border-l border-gray-200 pl-2 flex flex-col gap-0.5 pb-0.5">
            {allLinks.map((child) => {
              const childActive =
                location.pathname === child.path ||
                (child.path !== "/" &&
                  location.pathname.startsWith(child.path));
              return (
                <Link
                  key={child.path}
                  to={child.path}
                  className={`block px-3 py-1.5 rounded-md text-sm transition-colors ${
                    childActive
                      ? "bg-indigo-100 text-indigo-700 font-medium"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  {child.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function HamburgerIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default function App() {
  const location = useLocation();
  const { user, isAdmin, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Close mobile drawer on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const isAuthPage =
    location.pathname === "/login" || location.pathname === "/signup";

  if (isAuthPage) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Routes>
    );
  }

  const navItems: NavItem[] = [
    { path: "/", label: "Dashboard" },
    {
      path: "/clients",
      label: "Clients",
      children: [{ path: "/projects", label: "Projects" }],
    },
    {
      path: "/invoices",
      label: "Billing",
      children: [
        { path: "/invoices", label: "Invoices" },
        { path: "/time", label: "Time Tracking" },
        { path: "/import", label: "Import" },
      ],
    },
    {
      path: "/settings",
      label: "Settings",
      children: isAdmin
        ? [{ path: "/admin/invites", label: "Invites" }]
        : undefined,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 bg-white border-r flex flex-col shrink-0
          transform transition-all duration-200 ease-in-out
          md:relative md:translate-x-0 md:z-auto
          w-64
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          ${collapsed ? "md:w-12" : "md:w-56"}
        `}
      >
        {/* Sidebar header */}
        <div className={`px-4 py-4 border-b flex items-center ${collapsed ? "md:justify-center" : "justify-between"}`}>
          {!collapsed && (
            <Link to="/" className="flex items-center space-x-2 min-w-0">
              <img src="/logo.png" alt="TimeForge" className="h-8 shrink-0" />
              <span className="text-xl font-bold text-indigo-600 truncate">TimeForge</span>
            </Link>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden md:flex items-center justify-center w-8 h-8 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 shrink-0"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
        </div>

        {/* Nav */}
        {!collapsed && (
          <nav className="flex-1 px-2 py-4 flex flex-col gap-1 overflow-y-auto">
            {navItems.map((item) =>
              item.children ? (
                <SidebarAccordion
                  key={item.path}
                  item={item}
                  location={location}
                />
              ) : (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>
        )}

        {/* Logout */}
        {!collapsed && user && (
          <div className="px-2 py-4 border-t">
            <button
              onClick={logout}
              className="w-full px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 text-left"
            >
              Logout
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 bg-white border-b px-4 h-14 flex items-center gap-3 shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100"
          >
            <HamburgerIcon />
          </button>
          <Link to="/" className="flex items-center space-x-2">
            <img src="/logo.png" alt="TimeForge" className="h-7" />
            <span className="text-lg font-bold text-indigo-600">TimeForge</span>
          </Link>
        </header>

        <main className="flex-1 min-w-0 px-4 py-4 md:px-6 md:py-6">
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/time" element={<TimeEntriesPage />} />
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/invoices/new" element={<CreateInvoicePage />} />
              <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route element={<AdminRoute />}>
                <Route path="/admin/invites" element={<InvitesPage />} />
              </Route>
            </Route>
          </Routes>
        </main>
      </div>
    </div>
  );
}
