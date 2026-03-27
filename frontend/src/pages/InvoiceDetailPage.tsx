import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { gql } from '../api/client';
import { Invoice } from '../types';
import ConfirmModal from '../components/ConfirmModal';

const INVOICE_QUERY = `
  query($id: Int!) {
    invoice(id: $id) {
      id client_id client_name client_email client_address
      invoice_number status issue_date due_date
      subtotal tax_rate tax_amount credits_applied total notes
      line_items { id description quantity rate amount time_entry_id }
      credits { id description amount remaining_amount }
      created_at updated_at
    }
  }
`;

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: invoice, isLoading } = useQuery<Invoice>({
    queryKey: ['invoice', id],
    queryFn: async () => (await gql<{ invoice: Invoice }>(INVOICE_QUERY, { id: Number(id) })).invoice,
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      gql(`mutation($id: Int!, $status: String!) { updateInvoiceStatus(id: $id, status: $status) { id } }`,
        { id: Number(id), status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Status updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteInvoice = useMutation({
    mutationFn: () =>
      gql(`mutation($id: Int!) { deleteInvoice(id: $id) }`, { id: Number(id) }),
    onSuccess: () => {
      toast.success('Invoice deleted');
      navigate('/invoices');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function exportPdf() {
    if (!invoice) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const lineRows = (invoice.line_items || []).map((li) =>
      `<tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb">${li.description}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${Number(li.quantity).toFixed(2)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">$${Number(li.rate).toFixed(2)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">$${Number(li.amount).toFixed(2)}</td>
      </tr>`
    ).join('');

    let totalsHtml = `
      <tr><td colspan="3" style="padding:8px;text-align:right;color:#6b7280">Subtotal</td>
        <td style="padding:8px;text-align:right">$${Number(invoice.subtotal).toFixed(2)}</td></tr>`;
    if (Number(invoice.tax_rate) > 0) {
      totalsHtml += `<tr><td colspan="3" style="padding:8px;text-align:right;color:#6b7280">Tax (${Number(invoice.tax_rate)}%)</td>
        <td style="padding:8px;text-align:right">$${Number(invoice.tax_amount).toFixed(2)}</td></tr>`;
    }
    if (Number(invoice.credits_applied) > 0) {
      totalsHtml += `<tr><td colspan="3" style="padding:8px;text-align:right;color:#16a34a">Credits Applied</td>
        <td style="padding:8px;text-align:right;color:#16a34a">-$${Number(invoice.credits_applied).toFixed(2)}</td></tr>`;
      (invoice.credits || []).forEach((c) => {
        totalsHtml += `<tr><td colspan="3" style="padding:4px 8px;text-align:right;color:#16a34a;font-size:12px;padding-left:32px">${c.description}</td>
          <td style="padding:4px 8px;text-align:right;color:#16a34a;font-size:12px">-$${Number(c.amount).toFixed(2)}</td></tr>`;
      });
    }
    totalsHtml += `<tr style="border-top:2px solid #111"><td colspan="3" style="padding:8px;text-align:right;font-weight:bold;font-size:1.1em">Total</td>
      <td style="padding:8px;text-align:right;font-weight:bold;font-size:1.1em">$${Number(invoice.total).toFixed(2)}</td></tr>`;

    w.document.write(`<!DOCTYPE html><html><head><title>Invoice ${invoice.invoice_number}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; color: #111; }
        h1 { margin: 0 0 4px; } .meta { color: #6b7280; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th { text-align: left; padding: 8px; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-size: 13px; }
        .section { margin-bottom: 32px; }
        .status { display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: capitalize; }
        @media print { body { margin: 20px; } }
      </style></head><body>
      <div class="section">
        <h1>Invoice ${invoice.invoice_number}</h1>
        <p class="meta">Status: <span class="status">${invoice.status}</span></p>
      </div>
      <div style="display:flex;gap:60px;margin-bottom:32px">
        <div>
          <p class="meta" style="margin:0 0 4px;font-weight:600">Invoice Details</p>
          <p class="meta" style="margin:2px 0">Issue Date: ${new Date(invoice.issue_date).toLocaleDateString()}</p>
          <p class="meta" style="margin:2px 0">Due Date: ${new Date(invoice.due_date).toLocaleDateString()}</p>
        </div>
        <div>
          <p class="meta" style="margin:0 0 4px;font-weight:600">Bill To</p>
          <p style="margin:2px 0;font-weight:500">${invoice.client_name}</p>
          ${invoice.client_email ? `<p class="meta" style="margin:2px 0">${invoice.client_email}</p>` : ''}
          ${invoice.client_address ? `<p class="meta" style="margin:2px 0">${invoice.client_address}</p>` : ''}
        </div>
      </div>
      <table>
        <thead><tr>
          <th>Description</th><th style="text-align:right">Qty (hrs)</th>
          <th style="text-align:right">Rate</th><th style="text-align:right">Amount</th>
        </tr></thead>
        <tbody>${lineRows}</tbody>
        <tfoot>${totalsHtml}</tfoot>
      </table>
      ${invoice.notes ? `<div class="section" style="margin-top:32px"><p class="meta" style="font-weight:600;margin-bottom:4px">Notes</p><p style="font-size:14px;color:#374151;white-space:pre-wrap">${invoice.notes}</p></div>` : ''}
    </body></html>`);
    w.document.close();
    w.print();
  }

  function exportCsv() {
    if (!invoice) return;
    const rows = [['Description', 'Quantity (hrs)', 'Rate', 'Amount']];
    (invoice.line_items || []).forEach((li) => {
      rows.push([
        `"${li.description.replace(/"/g, '""')}"`,
        Number(li.quantity).toFixed(2),
        Number(li.rate).toFixed(2),
        Number(li.amount).toFixed(2),
      ]);
    });
    rows.push([]);
    rows.push(['Subtotal', '', '', Number(invoice.subtotal).toFixed(2)]);
    if (Number(invoice.tax_rate) > 0) {
      rows.push([`Tax (${Number(invoice.tax_rate)}%)`, '', '', Number(invoice.tax_amount).toFixed(2)]);
    }
    if (Number(invoice.credits_applied) > 0) {
      rows.push(['Credits Applied', '', '', `-${Number(invoice.credits_applied).toFixed(2)}`]);
    }
    rows.push(['Total', '', '', Number(invoice.total).toFixed(2)]);
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoice.invoice_number}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
          <button onClick={exportPdf}
            className="bg-gray-600 text-white px-3 py-2 rounded text-sm hover:bg-gray-700">Export PDF</button>
          <button onClick={exportCsv}
            className="bg-gray-600 text-white px-3 py-2 rounded text-sm hover:bg-gray-700">Export CSV</button>
          {nextStatuses.map((s) => (
            <button key={s} onClick={() => updateStatus.mutate(s)}
              className="bg-indigo-600 text-white px-3 py-2 rounded text-sm hover:bg-indigo-700 capitalize">
              Mark {s}
            </button>
          ))}
          <button onClick={() => setShowDeleteConfirm(true)}
            className="bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700">Delete</button>
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
            <>
              <div className="flex justify-between py-1 text-green-600">
                <span>Credits Applied</span>
                <span>-${Number(invoice.credits_applied).toFixed(2)}</span>
              </div>
              {(invoice.credits || []).map((c) => (
                <div key={c.id} className="flex justify-between py-0.5 text-xs text-green-500 pl-4">
                  <span>{c.description}</span>
                  <span>-${Number(c.amount).toFixed(2)}</span>
                </div>
              ))}
            </>
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

      <ConfirmModal
        open={showDeleteConfirm}
        message="Delete this invoice? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { setShowDeleteConfirm(false); deleteInvoice.mutate(); }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
