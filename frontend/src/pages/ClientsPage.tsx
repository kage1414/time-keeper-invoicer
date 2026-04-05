import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { gql } from '../api/client';
import { Client } from '../types';
import ConfirmModal from '../components/ConfirmModal';

const CLIENTS_QUERY = `query { clients { id name company email address1 address2 city state zip phone is_active created_at updated_at } }`;

function EditClientModal({ client, onClose }: { client: Partial<Client>; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Client>>({ is_active: true, ...client });
  const [validationError, setValidationError] = useState('');

  const save = useMutation({
    mutationFn: (c: Partial<Client>) => {
      const input = {
        name: c.name || null,
        company: c.company || null,
        email: c.email || null,
        address1: c.address1 || null,
        address2: c.address2 || null,
        city: c.city || null,
        state: c.state || null,
        zip: c.zip || null,
        phone: c.phone || null,
        ...(c.id ? { is_active: c.is_active } : {}),
      };
      if (c.id) {
        return gql(`mutation($id: Int!, $input: UpdateClientInput!) { updateClient(id: $id, input: $input) { id } }`,
          { id: c.id, input });
      }
      return gql(`mutation($input: CreateClientInput!) { createClient(input: $input) { id } }`, { input });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client saved');
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (field: keyof Client, value: any) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{form.id ? 'Edit Client' : 'New Client'}</h2>
          {form.id && (
            <button
              onClick={() => set('is_active', !form.is_active)}
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                form.is_active
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${form.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
              {form.is_active ? 'Active' : 'Inactive'}
            </button>
          )}
        </div>
        <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-gray-400 font-normal">(or company required)</span></label>
            <input className="border rounded p-2 w-full" value={form.name || ''}
              onChange={(e) => set('name', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company <span className="text-gray-400 font-normal">(or name required)</span></label>
            <input className="border rounded p-2 w-full" value={form.company || ''}
              onChange={(e) => set('company', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input className="border rounded p-2 w-full" type="email" value={form.email || ''}
              onChange={(e) => set('email', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input className="border rounded p-2 w-full" value={form.phone || ''}
              onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
            <input className="border rounded p-2 w-full" value={form.address1 || ''}
              onChange={(e) => set('address1', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
            <input className="border rounded p-2 w-full" value={form.address2 || ''}
              onChange={(e) => set('address2', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input className="border rounded p-2 w-full" value={form.city || ''}
              onChange={(e) => set('city', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <input className="border rounded p-2 w-full" value={form.state || ''}
              onChange={(e) => set('state', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zip</label>
            <input className="border rounded p-2 w-full" value={form.zip || ''}
              onChange={(e) => set('zip', e.target.value)} />
          </div>
        </div>
        {validationError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mx-6">{validationError}</p>
        )}
        <div className="flex gap-2 px-6 py-4 border-t justify-end">
          <button onClick={onClose} className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300">Cancel</button>
          <button
            onClick={() => {
              if (!form.name && !form.company) {
                setValidationError('A name or company is required.');
                return;
              }
              setValidationError('');
              save.mutate(form);
            }}
            disabled={save.isPending}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const qc = useQueryClient();
  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: async () => (await gql<{ clients: Client[] }>(CLIENTS_QUERY)).clients,
  });

  const [editing, setEditing] = useState<Partial<Client> | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const remove = useMutation({
    mutationFn: (id: number) =>
      gql(`mutation($id: Int!) { deleteClient(id: $id) }`, { id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client deleted');
    },
  });

  const visibleClients = showInactive ? clients : clients.filter((c) => c.is_active !== false);

  if (isLoading) return <div className="text-center py-12">Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Clients</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded" />
            Show inactive
          </label>
          <button
            onClick={() => setEditing({ name: '', company: '', email: '', address1: '', address2: '', city: '', state: '', zip: '', phone: '' })}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >
            Add Client
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleClients.map((c) => (
              <tr key={c.id} className={`border-t hover:bg-gray-50 ${c.is_active === false ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-medium">{c.name || c.company}</td>
                <td className="px-4 py-3">{c.email}</td>
                <td className="px-4 py-3">{c.phone}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                    c.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${c.is_active !== false ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {c.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => setEditing(c)} className="text-indigo-600 hover:underline mr-3">Edit</button>
                  <button onClick={() => setConfirmDeleteId(c.id)} className="text-red-600 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
            {visibleClients.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No clients</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && <EditClientModal client={editing} onClose={() => setEditing(null)} />}

      <ConfirmModal
        open={confirmDeleteId !== null}
        message="Delete this client?"
        confirmLabel="Delete"
        onConfirm={() => { if (confirmDeleteId !== null) remove.mutate(confirmDeleteId); setConfirmDeleteId(null); }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
