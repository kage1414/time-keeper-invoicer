import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { Client, TimeEntry, Credit } from '../types';

export default function CreateInvoicePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [clientId, setClientId] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [notes, setNotes] = useState('');
  const [dueInDays, setDueInDays] = useState('30');
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set());
  const [selectedCredits, setSelectedCredits] = useState<Set<number>>(new Set());

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients'),
  });

  const { data: unbilledEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: ['unbilledEntries', clientId],
    queryFn: () => api.get(`/time-entries?unbilled=true&client_id=${clientId}`),
    enabled: !!clientId,
  });

  const { data: availableCredits = [] } = useQuery<Credit[]>({
    queryKey: ['availableCredits', clientId],
    queryFn: () => api.get(`/credits?client_id=${clientId}&available=true`),
    enabled: !!clientId,
  });

  const createInvoice = useMutation({
    mutationFn: () => {
      const today = new Date();
      const due = new Date(today);
      due.setDate(due.getDate() + Number(dueInDays));

      return api.post<{ id: number }>('/invoices', {
        client_id: Number(clientId),
        issue_date: today.toISOString().split('T')[0],
        due_date: due.toISOString().split('T')[0],
        tax_rate: Number(taxRate),
        notes,
        time_entry_ids: Array.from(selectedEntries),
        credit_ids: Array.from(selectedCredits),
      });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['timeEntries'] });
      qc.invalidateQueries({ queryKey: ['credits'] });
      toast.success('Invoice created');
      navigate(`/invoices/${data.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleEntry(id: number) {
    const next = new Set(selectedEntries);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedEntries(next);
  }

  function toggleCredit(id: number) {
    const next = new Set(selectedCredits);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedCredits(next);
  }

  function selectAll() {
    setSelectedEntries(new Set(unbilledEntries.map((e) => e.id)));
  }

  const selectedAmount = unbilledEntries
    .filter((e) => selectedEntries.has(e.id))
    .reduce((sum, e) => {
      const rate = e.rate_override ?? e.default_rate;
      return sum + (e.duration_minutes / 60) * Number(rate);
    }, 0);

  const creditAmount = availableCredits
    .filter((c) => selectedCredits.has(c.id))
    .reduce((sum, c) => sum + Number(c.remaining_amount), 0);

  const tax = selectedAmount * (Number(taxRate) / 100);
  const total = Math.max(0, selectedAmount + tax - creditAmount);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Create Invoice</h1>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
            <select
              className="border rounded p-2 w-full"
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); setSelectedEntries(new Set()); setSelectedCredits(new Set()); }}
            >
              <option value="">Select Client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
            <input className="border rounded p-2 w-full" type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due In (days)</label>
            <input className="border rounded p-2 w-full" type="number" value={dueInDays} onChange={(e) => setDueInDays(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input className="border rounded p-2 w-full" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      </div>

      {clientId && (
        <>
          {/* Time Entries Selection */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold">Unbilled Time Entries</h2>
              {unbilledEntries.length > 0 && (
                <button onClick={selectAll} className="text-indigo-600 text-sm hover:underline">Select All</button>
              )}
            </div>
            {unbilledEntries.length === 0 ? (
              <p className="text-gray-500 text-sm">No unbilled time entries for this client.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 w-8"></th>
                    <th className="pb-2">Project</th>
                    <th className="pb-2">Description</th>
                    <th className="pb-2">Date</th>
                    <th className="pb-2 text-right">Hours</th>
                    <th className="pb-2 text-right">Rate</th>
                    <th className="pb-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {unbilledEntries.map((e) => {
                    const rate = e.rate_override ?? e.default_rate;
                    const hours = e.duration_minutes / 60;
                    const amount = hours * Number(rate);
                    return (
                      <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer" onClick={() => toggleEntry(e.id)}>
                        <td className="py-2">
                          <input type="checkbox" checked={selectedEntries.has(e.id)} onChange={() => toggleEntry(e.id)} />
                        </td>
                        <td className="py-2">{e.project_name}</td>
                        <td className="py-2">{e.description || '-'}</td>
                        <td className="py-2">{new Date(e.start_time).toLocaleDateString()}</td>
                        <td className="py-2 text-right">{hours.toFixed(2)}</td>
                        <td className="py-2 text-right">${Number(rate).toFixed(2)}</td>
                        <td className="py-2 text-right">${amount.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Credits Selection */}
          {availableCredits.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4 mb-6">
              <h2 className="font-semibold mb-3">Available Credits</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 w-8"></th>
                    <th className="pb-2">Description</th>
                    <th className="pb-2 text-right">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {availableCredits.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer" onClick={() => toggleCredit(c.id)}>
                      <td className="py-2">
                        <input type="checkbox" checked={selectedCredits.has(c.id)} onChange={() => toggleCredit(c.id)} />
                      </td>
                      <td className="py-2">{c.description}</td>
                      <td className="py-2 text-right">${Number(c.remaining_amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <h2 className="font-semibold mb-3">Summary</h2>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Subtotal ({selectedEntries.size} entries)</span>
                <span>${selectedAmount.toFixed(2)}</span>
              </div>
              {Number(taxRate) > 0 && (
                <div className="flex justify-between">
                  <span>Tax ({taxRate}%)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
              )}
              {creditAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Credits</span>
                  <span>-${creditAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => createInvoice.mutate()}
            disabled={selectedEntries.size === 0}
            className="bg-indigo-600 text-white px-6 py-3 rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Invoice
          </button>
        </>
      )}
    </div>
  );
}
