import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Invoice, Client } from '../types';
import { useState } from 'react';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-yellow-100 text-yellow-800',
};

export default function InvoicesPage() {
  const [filterClient, setFilterClient] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const params = new URLSearchParams();
  if (filterClient) params.set('client_id', filterClient);
  if (filterStatus) params.set('status', filterStatus);
  const qs = params.toString();

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices', qs],
    queryFn: () => api.get(`/invoices${qs ? `?${qs}` : ''}`),
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients'),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <Link to="/invoices/new" className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
          Create Invoice
        </Link>
      </div>

      <div className="flex gap-3 mb-4">
        <select className="border rounded p-2 text-sm" value={filterClient} onChange={(e) => setFilterClient(e.target.value)}>
          <option value="">All Clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="border rounded p-2 text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-center py-12">Loading...</p>
      ) : invoices.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No invoices found.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Invoice #</th>
                <th className="text-left p-3">Client</th>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Due</th>
                <th className="text-left p-3">Total</th>
                <th className="text-left p-3">Credits</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t hover:bg-gray-50">
                  <td className="p-3">
                    <Link to={`/invoices/${inv.id}`} className="text-indigo-600 hover:underline font-medium">
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="p-3">{inv.client_name}</td>
                  <td className="p-3">{new Date(inv.issue_date).toLocaleDateString()}</td>
                  <td className="p-3">{new Date(inv.due_date).toLocaleDateString()}</td>
                  <td className="p-3 font-medium">${Number(inv.total).toFixed(2)}</td>
                  <td className="p-3">{Number(inv.credits_applied) > 0 ? `-$${Number(inv.credits_applied).toFixed(2)}` : '-'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[inv.status]}`}>
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
  );
}
