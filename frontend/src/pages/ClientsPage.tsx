import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { Client } from '../types';

export default function ClientsPage() {
  const qc = useQueryClient();
  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients'),
  });

  const [editing, setEditing] = useState<Partial<Client> | null>(null);

  const save = useMutation({
    mutationFn: (c: Partial<Client>) =>
      c.id ? api.put(`/clients/${c.id}`, c) : api.post('/clients', c),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      setEditing(null);
      toast.success('Client saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/clients/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client deleted');
    },
  });

  if (isLoading) return <div className="text-center py-12">Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Clients</h1>
        <button
          onClick={() => setEditing({ name: '', email: '', address: '', phone: '' })}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
        >
          Add Client
        </button>
      </div>

      {editing && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="font-semibold mb-3">{editing.id ? 'Edit' : 'New'} Client</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="border rounded px-3 py-2" placeholder="Name *" value={editing.name || ''}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <input className="border rounded px-3 py-2" placeholder="Email" value={editing.email || ''}
              onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
            <input className="border rounded px-3 py-2" placeholder="Phone" value={editing.phone || ''}
              onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            <input className="border rounded px-3 py-2" placeholder="Address" value={editing.address || ''}
              onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => save.mutate(editing)}
              className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">Save</button>
            <button onClick={() => setEditing(null)}
              className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">{c.email}</td>
                <td className="px-4 py-3">{c.phone}</td>
                <td className="px-4 py-3">
                  <button onClick={() => setEditing(c)} className="text-indigo-600 hover:underline mr-3">Edit</button>
                  <button onClick={() => { if (confirm('Delete this client?')) remove.mutate(c.id); }}
                    className="text-red-600 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No clients yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
