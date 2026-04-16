import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { gql } from "../api/client";
import { Dashboard, Project } from "../types";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

const DASHBOARD_QUERY = `
  query {
    dashboard {
      total_clients
      active_projects
      running_timers { id project_id project_name client_name description start_time default_rate rate_override }
      unbilled_hours
      unbilled_amount
      recent_invoices { id invoice_number client_name total status }
      outstanding_amount
    }
  }
`;

const PROJECTS_QUERY = `query { projects(is_active: true) { id name client_name client_id } }`;
const USER_SETTINGS_QUERY = `query { userSettings { show_earnings_on_timer } }`;

function ElapsedTime({ startTime, rate, showEarnings }: { startTime: string; rate?: number; showEarnings?: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.floor((now - new Date(startTime).getTime()) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const earnings = rate != null ? (elapsed / 3600) * rate : null;
  return (
    <span className="font-mono text-green-700 text-xl font-bold">
      {pad(h)}:{pad(m)}:{pad(s)}
      {showEarnings && earnings != null && (
        <span className="ml-2 text-green-600">${earnings.toFixed(2)}</span>
      )}
    </span>
  );
}

export default function DashboardPage() {
  const qc = useQueryClient();
  const [selectedProject, setSelectedProject] = useState("");
  const [description, setDescription] = useState("");

  const { data, isLoading } = useQuery<Dashboard>({
    queryKey: ["dashboard"],
    queryFn: async () =>
      (await gql<{ dashboard: Dashboard }>(DASHBOARD_QUERY)).dashboard,
    refetchInterval: 10000,
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () =>
      (await gql<{ projects: Project[] }>(PROJECTS_QUERY)).projects,
  });

  const { data: userSettings } = useQuery<{ show_earnings_on_timer: boolean }>({
    queryKey: ["userSettings"],
    queryFn: async () =>
      (await gql<{ userSettings: { show_earnings_on_timer: boolean } }>(USER_SETTINGS_QUERY)).userSettings,
  });

  const startTimer = useMutation({
    mutationFn: () =>
      gql(
        `mutation($input: CreateTimeEntryInput!) { createTimeEntry(input: $input) { id } }`,
        {
          input: {
            project_id: Number(selectedProject),
            description: description || null,
            start_time: new Date().toISOString(),
            is_billable: true,
          },
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setDescription("");
      toast.success("Timer started");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stopTimer = useMutation({
    mutationFn: (id: number) =>
      gql(`mutation($id: Int!) { stopTimeEntry(id: $id) { id } }`, { id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["timeEntries"] });
      toast.success("Timer stopped");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-center py-12">Loading...</div>;
  if (!data) return null;

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-800",
    sent: "bg-blue-100 text-blue-800",
    paid: "bg-green-100 text-green-800",
    overdue: "bg-red-100 text-red-800",
    cancelled: "bg-yellow-100 text-yellow-800",
  };

  // Group projects by client for the dropdown
  const clientGroups = projects.reduce<Record<string, Project[]>>((acc, p) => {
    const key = p.client_name || "Unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const hasRunning = data.running_timers.length > 0;
  const timer = data.running_timers[0];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Clients" value={data.total_clients} />
        <StatCard label="Active Projects" value={data.active_projects} />
        <StatCard label="Unbilled Hours" value={data.unbilled_hours} />
        <StatCard
          label="Unbilled Amount"
          value={`$${data.unbilled_amount.toFixed(2)}`}
        />
        <StatCard
          label="Outstanding"
          value={`$${data.outstanding_amount.toFixed(2)}`}
        />
        <StatCard label="Running Timers" value={data.running_timers.length} />
      </div>

      {/* Timer card */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        {hasRunning ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <h2 className="text-lg font-semibold">Timer Running</h2>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-medium text-gray-900">
                  {timer.project_name}
                </p>
                {timer.client_name && (
                  <p className="text-sm text-gray-500">{timer.client_name}</p>
                )}
                {timer.description && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {timer.description}
                  </p>
                )}
                <div className="mt-2">
                  {timer.start_time && (
                    <ElapsedTime
                      startTime={timer.start_time}
                      rate={timer.rate_override ?? timer.default_rate}
                      showEarnings={userSettings?.show_earnings_on_timer}
                    />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/time"
                  className="text-sm text-indigo-600 hover:underline"
                >
                  View all
                </Link>
                <button
                  onClick={() => stopTimer.mutate(timer.id)}
                  disabled={stopTimer.isPending}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Stop
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-semibold mb-3">Quick Start Timer</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (selectedProject) startTimer.mutate();
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <select
                className="border rounded p-2 text-sm flex-1"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                required
              >
                <option value="">Select project…</option>
                {Object.entries(clientGroups).map(([client, projs]) => (
                  <optgroup key={client} label={client}>
                    {projs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <input
                className="border rounded p-2 text-sm flex-1"
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <button
                type="submit"
                disabled={!selectedProject || startTimer.isPending}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                Start Timer
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Recent Invoices */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Recent Invoices</h2>
          <Link
            to="/invoices"
            className="text-indigo-600 text-sm hover:underline"
          >
            View all
          </Link>
        </div>
        {data.recent_invoices.length === 0 ? (
          <p className="text-gray-500">No invoices yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2">Number</th>
                  <th className="pb-2">Client</th>
                  <th className="pb-2">Total</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="py-2">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="py-2">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {inv.client_name}
                      </Link>
                    </td>
                    <td className="py-2">${Number(inv.total).toFixed(2)}</td>
                    <td className="py-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${statusColors[inv.status]}`}
                      >
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
