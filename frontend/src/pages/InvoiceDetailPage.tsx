import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { Invoice } from '../types';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-yellow-100 text-yellow-800',
};

const statusTransitions: Record<string, string[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['paid', 'overdue', 'cancelled'],
  overdue: ['paid', 'cancelled'],
  paid: [],
  cancelled: ['draft'],
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: invoice, isLoading } = useQuery<Invoice>({
    queryKey: ['invoice', id],
    queryFn: () => api.get(`/invoices/${id}`),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => api.put(`/invoices/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Status updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteInvoice = useMutation({
    mutationFn: () => api.del(`/invoices/${id}`),
    onSuccess: () => {
      toast.success('Invoice deleted');
      navigate('/invoices');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-center py-12">Loading...</div>;
  if (!invoice) return <div className="text-center py-12">Invoice not found</div>;

  const nextStatuses = statusTransitions[invoice.status] || [];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link to="/invoices" className="text-indigo-600 hover:underline text-sm">&larr; Back to Invoices</Link>
          <h1 className="text-2xl font-bold mt-1">Invoice {invoice.invoice_number}</h1>
        </div>
        <div className="flex gap-2">
          {nextStatuses.map((s) => (
            <button
              key={s}
              onClick={() => updateStatus.mutate(s)}
              className="bg-indigo-600 text-white px-3 py-2 rounded text-sm hover:bg-indigo-700 capitalize"
            >
              Mark {s}
            </button>
          ))}
          {invoice.status === 'draft' && (
            <button
              onClick={() => { if (confirm('Delete this invoice?')) deleteInvoice.mutate(); }}
              className="bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-2">Invoice Details</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-gray-500">Status</dt>
            <dd><span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[invoice.status]}`}>{invoice.status}</span></dd>
            <dt className="text-gray-500">Issue Date</dt>
            <dd>{new Date(invoice.issue_date).toLocaleDateString()}</dd>
            <dt className="text-gray-500">Due Date</dt>
            <dd>{new Date(invoice.due_date).toLocaleDateString()}</dd>
          </dl>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-2">Client</h2>
          <p className="font-medium">{invoice.client_name}</p>
          {invoice.client_email && <p className="text-sm text-gray-500">{invoice.client_email}</p>}
          {invoice.client_address && <p className="text-sm text-gray-500">{invoice.client_address}</p>}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="font-semibold mb-3">Line Items</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="pb-2">Description</th>
              <th className="pb-2 text-right">Qty (hrs)</th>
              <th className="pb-2 text-right">Rate</th>
              <th className="pb-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.line_items || []).map((li) => (
              <tr key={li.id} className="border-b last:border-0">
                <td className="py-2">{li.description}</td>
                <td className="py-2 text-right">{Number(li.quantity).toFixed(2)}</td>
                <td className="py-2 text-right">${Number(li.rate).toFixed(2)}</td>
                <td className="py-2 text-right">${Number(li.amount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t mt-4 pt-4 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-gray-500">Subtotal</span>
            <span>${Number(invoice.subtotal).toFixed(2)}</span>
          </div>
          {Number(invoice.tax_rate) > 0 && (
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Tax ({Number(invoice.tax_rate)}%)</span>
              <span>${Number(invoice.tax_amount).toFixed(2)}</span>
            </div>
          )}
          {Number(invoice.credits_applied) > 0 && (
            <div className="flex justify-between py-1 text-green-600">
              <span>Credits Applied</span>
              <span>-${Number(invoice.credits_applied).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between py-1 font-bold text-lg border-t mt-2 pt-2">
            <span>Total</span>
            <span>${Number(invoice.total).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {invoice.notes && (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-2">Notes</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}
    </div>
  );
}
