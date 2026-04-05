import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { gql } from '../api/client';
import { Client, TimeEntry, UserSettings } from '../types';

type EntryAction = 'bill' | 'credit';

const CLIENTS_QUERY = `query { clients { id name company } }`;
const SETTINGS_QUERY = `query { userSettings { default_due_days } }`;

const UNBILLED_ENTRIES_QUERY = `
  query($client_id: Int, $unbilled: Boolean) {
    timeEntries(client_id: $client_id, unbilled: $unbilled) {
      id project_id project_name description start_time
      duration_minutes rate_override default_rate
    }
  }
`;

const BILLED_ENTRIES_QUERY = `
  query($client_id: Int, $billed: Boolean) {
    timeEntries(client_id: $client_id, billed: $billed) {
      id project_id project_name description start_time
      duration_minutes rate_override default_rate
    }
  }
`;

export default function CreateInvoicePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [clientId, setClientId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [notes, setNotes] = useState('');
  const [dueInDays, setDueInDays] = useState('');
  const [entryActions, setEntryActions] = useState<Map<number, EntryAction>>(new Map());
  const [billedCredits, setBilledCredits] = useState<Set<number>>(new Set());

  const { data: settings } = useQuery<{ default_due_days: number | null }>({
    queryKey: ['userSettings'],
    queryFn: async () => (await gql<{ userSettings: { default_due_days: number | null } }>(SETTINGS_QUERY)).userSettings,
  });

  useEffect(() => {
    if (settings && dueInDays === '') {
      setDueInDays(String(settings.default_due_days ?? 30));
    }
  }, [settings]);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: async () => (await gql<{ clients: Client[] }>(CLIENTS_QUERY)).clients,
  });

  const { data: unbilledEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: ['unbilledEntries', clientId],
    queryFn: async () => (await gql<{ timeEntries: TimeEntry[] }>(UNBILLED_ENTRIES_QUERY,
      { client_id: Number(clientId), unbilled: true })).timeEntries,
    enabled: !!clientId,
  });

  const { data: billedEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: ['billedEntries', clientId],
    queryFn: async () => (await gql<{ timeEntries: TimeEntry[] }>(BILLED_ENTRIES_QUERY,
      { client_id: Number(clientId), billed: true })).timeEntries,
    enabled: !!clientId,
  });

  const createInvoice = useMutation({
    mutationFn: () => {
      const today = new Date();
      const due = new Date(today);
      due.setDate(due.getDate() + Number(dueInDays));

      const billIds: number[] = [];
      const creditUnbilledIds: number[] = [];
      entryActions.forEach((action, id) => {
        if (action === 'bill') billIds.push(id);
        else creditUnbilledIds.push(id);
      });

      return gql<{ createInvoice: { id: number } }>(
        `mutation($input: CreateInvoiceInput!) { createInvoice(input: $input) { id } }`,
        {
          input: {
            client_id: Number(clientId),
            invoice_number: invoiceNumber || null,
            issue_date: today.toISOString().split('T')[0],
            due_date: due.toISOString().split('T')[0],
            tax_rate: Number(taxRate),
            notes: notes || null,
            time_entry_ids: billIds,
            credit_time_entry_ids: [...creditUnbilledIds, ...Array.from(billedCredits)],
          },
        }
      );
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['timeEntries'] });
      qc.invalidateQueries({ queryKey: ['credits'] });
      toast.success('Invoice created');
      navigate(`/invoices/${data.createInvoice.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function setEntryAction(id: number, action: EntryAction) {
    const next = new Map(entryActions);
    next.set(id, action);
    setEntryActions(next);
  }

  function removeEntryAction(id: number) {
    const next = new Map(entryActions);
    next.delete(id);
    setEntryActions(next);
  }

  function toggleEntryAction(id: number, action: EntryAction) {
    if (entryActions.get(id) === action) {
      removeEntryAction(id);
    } else {
      setEntryAction(id, action);
    }
  }

  function selectAllBill() {
    const next = new Map(entryActions);
    unbilledEntries.forEach((e) => next.set(e.id, 'bill'));
    setEntryActions(next);
  }

  function toggleBilledCredit(id: number) {
    const next = new Set(billedCredits);
    next.has(id) ? next.delete(id) : next.add(id);
    setBilledCredits(next);
  }

  function resetSelections() {
    setEntryActions(new Map());
    setBilledCredits(new Set());
  }

  function entryAmount(e: TimeEntry): number {
    const rate = e.rate_override ?? e.default_rate;
    return (e.duration_minutes / 60) * Number(rate);
  }

  const billAmount = unbilledEntries
    .filter((e) => entryActions.get(e.id) === 'bill')
    .reduce((sum, e) => sum + entryAmount(e), 0);

  const unbilledCreditAmount = unbilledEntries
    .filter((e) => entryActions.get(e.id) === 'credit')
    .reduce((sum, e) => sum + entryAmount(e), 0);

  const billedCreditAmount = billedEntries
    .filter((e) => billedCredits.has(e.id))
    .reduce((sum, e) => sum + entryAmount(e), 0);

  const totalCreditAmount = unbilledCreditAmount + billedCreditAmount;
  const tax = billAmount * (Number(taxRate) / 100);
  const total = Math.max(0, billAmount + tax - totalCreditAmount);

  const hasSelections = entryActions.size > 0 || billedCredits.size > 0;

  return (
    <div>
      <Link to="/invoices" className="text-indigo-600 hover:underline text-sm">&larr; Back to Invoices</Link>
      <h1 className="text-2xl font-bold mb-6 mt-1">Create Invoice</h1>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
            <select className="border rounded p-2 w-full" value={clientId}
              onChange={(e) => { setClientId(e.target.value); resetSelections(); }}>
              <option value="">Select Client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name || c.company}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice #</label>
            <input className="border rounded p-2 w-full" placeholder="Auto-generated" value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)} />
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
          {/* Unbilled Time Entries */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold">Unbilled Time Entries</h2>
              {unbilledEntries.length > 0 && (
                <button onClick={selectAllBill} className="text-indigo-600 text-sm hover:underline">Bill All</button>
              )}
            </div>
            {unbilledEntries.length === 0 ? (
              <p className="text-gray-500 text-sm">No unbilled time entries for this client.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2">Project</th>
                    <th className="pb-2">Description</th>
                    <th className="pb-2">Date</th>
                    <th className="pb-2 text-right">Hours</th>
                    <th className="pb-2 text-right">Rate</th>
                    <th className="pb-2 text-right">Amount</th>
                    <th className="pb-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {unbilledEntries.map((e) => {
                    const rate = e.rate_override ?? e.default_rate;
                    const hours = e.duration_minutes / 60;
                    const amount = hours * Number(rate);
                    const action = entryActions.get(e.id);
                    return (
                      <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2">{e.project_name}</td>
                        <td className="py-2">{e.description || '-'}</td>
                        <td className="py-2">{new Date(e.start_time).toLocaleDateString()}</td>
                        <td className="py-2 text-right">{hours.toFixed(2)}</td>
                        <td className="py-2 text-right">${Number(rate).toFixed(2)}</td>
                        <td className="py-2 text-right">${amount.toFixed(2)}</td>
                        <td className="py-2 text-center space-x-1">
                          <button onClick={() => toggleEntryAction(e.id, 'bill')}
                            className={`px-2 py-1 rounded text-xs font-medium border ${action === 'bill' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'}`}>
                            Bill
                          </button>
                          <button onClick={() => toggleEntryAction(e.id, 'credit')}
                            className={`px-2 py-1 rounded text-xs font-medium border ${action === 'credit' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'}`}>
                            Credit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Billed Time Entries (for crediting) */}
          {billedEntries.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4 mb-6">
              <h2 className="font-semibold mb-3">Billed Time Entries (Credit)</h2>
              <p className="text-gray-500 text-xs mb-3">Select previously billed entries to create credits applied to this invoice.</p>
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
                  {billedEntries.map((e) => {
                    const rate = e.rate_override ?? e.default_rate;
                    const hours = e.duration_minutes / 60;
                    const amount = hours * Number(rate);
                    return (
                      <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer" onClick={() => toggleBilledCredit(e.id)}>
                        <td className="py-2">
                          <input type="checkbox" checked={billedCredits.has(e.id)} onChange={() => toggleBilledCredit(e.id)} />
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
            </div>
          )}

          {/* Summary */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <h2 className="font-semibold mb-3">Summary</h2>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Subtotal ({Array.from(entryActions.values()).filter((a) => a === 'bill').length} entries)</span>
                <span>${billAmount.toFixed(2)}</span>
              </div>
              {Number(taxRate) > 0 && (
                <div className="flex justify-between">
                  <span>Tax ({taxRate}%)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
              )}
              {totalCreditAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Credits</span>
                  <span>-${totalCreditAmount.toFixed(2)}</span>
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
            disabled={!hasSelections}
            className="bg-indigo-600 text-white px-6 py-3 rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Invoice
          </button>
        </>
      )}
    </div>
  );
}
