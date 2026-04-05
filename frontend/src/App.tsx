import { useState } from "react";
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
  const allLinks = [
    { path: item.path, label: item.label },
    ...(item.children ?? []),
  ];

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

export default function App() {
  const location = useLocation();
  const { user, isAdmin, logout } = useAuth();

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
      label: "Invoices",
      children: [
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
      <aside className="w-56 shrink-0 bg-white border-r flex flex-col">
        <div className="px-4 py-4 border-b">
          <Link to="/" className="flex items-center space-x-2">
            <img src="/logo.png" alt="TimeForge" className="h-8" />
            <span className="text-xl font-bold text-indigo-600">TimeForge</span>
          </Link>
        </div>
        <nav className="flex-1 px-2 py-4 flex flex-col gap-1">
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
        {user && (
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

      <main className="flex-1 min-w-0 px-6 py-6">
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
  );
}
