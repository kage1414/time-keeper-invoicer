import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { gql } from '../api/client';
import { Credit, Client } from '../types';
import ConfirmModal from '../components/ConfirmModal';

const CREDITS_QUERY = `
  query {
    credits {
      id client_id client_name amount remaining_amount
      description source_invoice_id applied_invoice_id created_at
    }
  }
`;

const CLIENTS_QUERY = `query { clients { id name company } }`;

export default function CreditsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [clientId, setClientId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const { data: credits = [], isLoading } = useQuery<Credit[]>({
    queryKey: ['credits'],
    queryFn: async () => (await gql<{ credits: Credit[] }>(CREDITS_QUERY)).credits,
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: async () => (await gql<{ clients: Client[] }>(CLIENTS_QUERY)).clients,
  });

  const create = useMutation({
    mutationFn: () =>
      gql(`mutation($input: CreateCreditInput!) { createCredit(input: $input) { id } }`, {
        input: {
          client_id: Number(clientId),
          amount: Number(amount),
          description,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credits'] });
      toast.success('Credit created');
      setShowForm(false);
      setClientId('');
      setAmount('');
      setDescription('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) =>
      gql(`mutation($id: Int!) { deleteCredit(id: $id) }`, { id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credits'] });
      toast.success('Credit deleted');
    },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Credits</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
        >
          {showForm ? 'Cancel' : 'Add Credit'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
          className="bg-white rounded-lg shadow p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <select className="border rounded p-2" required value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Select Client *</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name || c.company}</option>)}
          </select>
          <input className="border rounded p-2" placeholder="Amount *" type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className="border rounded p-2" placeholder="Description *" required value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="md:col-span-3">
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">Create Credit</button>
          </div>
        </form>
      )}

      <p className="text-sm text-gray-500 mb-4">
        Credits represent prepayments or adjustments. Available credits are automatically applied when creating an invoice.
      </p>

      {isLoading ? (
        <p className="text-center py-12">Loading...</p>
      ) : credits.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No credits yet.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Client</th>
                <th className="text-left p-3">Description</th>
                <th className="text-right p-3">Original</th>
                <th className="text-right p-3">Remaining</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Created</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {credits.map((c) => (
                <tr key={c.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">{c.client_name}</td>
                  <td className="p-3">{c.description}</td>
                  <td className="p-3 text-right">${Number(c.amount).toFixed(2)}</td>
                  <td className="p-3 text-right">${Number(c.remaining_amount).toFixed(2)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      Number(c.remaining_amount) > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {Number(c.remaining_amount) > 0 ? 'Available' : 'Used'}
                    </span>
                  </td>
                  <td className="p-3">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="p-3 text-right">
                    {Number(c.remaining_amount) > 0 && (
                      <button onClick={() => setConfirmDeleteId(c.id)} className="text-red-600 hover:underline text-sm">Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={confirmDeleteId !== null}
        message="Delete this credit?"
        confirmLabel="Delete"
        onConfirm={() => { if (confirmDeleteId !== null) remove.mutate(confirmDeleteId); setConfirmDeleteId(null); }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
