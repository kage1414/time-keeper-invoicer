import { useQuery } from '@tanstack/react-query';
import { gql } from '../api/client';
import { Dashboard } from '../types';
import { Link } from 'react-router-dom';

const DASHBOARD_QUERY = `
  query {
    dashboard {
      total_clients
      active_projects
      running_timers { id project_name description start_time }
      unbilled_hours
      unbilled_amount
      recent_invoices { id invoice_number client_name total status }
      outstanding_amount
    }
  }
`;

export default function DashboardPage() {
  const { data, isLoading } = useQuery<Dashboard>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await gql<{ dashboard: Dashboard }>(DASHBOARD_QUERY);
      return res.dashboard;
    },
    refetchInterval: 30000,
  });

  if (isLoading) return <div className="text-center py-12">Loading...</div>;
  if (!data) return null;

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    sent: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800',
    cancelled: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Clients" value={data.total_clients} />
        <StatCard label="Active Projects" value={data.active_projects} />
        <StatCard label="Unbilled Hours" value={data.unbilled_hours} />
        <StatCard label="Unbilled Amount" value={`$${data.unbilled_amount.toFixed(2)}`} />
        <StatCard label="Outstanding" value={`$${data.outstanding_amount.toFixed(2)}`} />
        <StatCard label="Running Timers" value={data.running_timers.length} />
      </div>

      {data.running_timers.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">Running Timers</h2>
          {data.running_timers.map((t) => (
            <div key={t.id} className="flex justify-between items-center py-2 border-b last:border-0">
              <div>
                <span className="font-medium">{t.project_name}</span>
                {t.description && <span className="text-gray-500 ml-2">- {t.description}</span>}
              </div>
              <span className="text-green-600 font-mono text-sm animate-pulse">Running</span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Recent Invoices</h2>
          <Link to="/invoices" className="text-indigo-600 text-sm hover:underline">View all</Link>
        </div>
        {data.recent_invoices.length === 0 ? (
          <p className="text-gray-500">No invoices yet</p>
        ) : (
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
                    <Link to={`/invoices/${inv.id}`} className="text-indigo-600 hover:underline">
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="py-2">{inv.client_name}</td>
                  <td className="py-2">${Number(inv.total).toFixed(2)}</td>
                  <td className="py-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[inv.status]}`}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
