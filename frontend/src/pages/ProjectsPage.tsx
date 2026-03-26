import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { Project, Client } from '../types';

const emptyProject = { client_id: '', name: '', description: '', default_rate: '100' };

export default function ProjectsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyProject);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects'),
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients'),
  });

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, client_id: Number(form.client_id), default_rate: Number(form.default_rate) };
      return editingId ? api.put(`/projects/${editingId}`, body) : api.post('/projects', body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success(editingId ? 'Project updated' : 'Project created');
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/projects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
    },
  });

  function resetForm() {
    setForm(emptyProject);
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(p: Project) {
    setForm({ client_id: String(p.client_id), name: p.name, description: p.description || '', default_rate: String(p.default_rate) });
    setEditingId(p.id);
    setShowForm(true);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
          {showForm ? 'Cancel' : 'Add Project'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="bg-white rounded-lg shadow p-4 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <select className="border rounded p-2" required value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
            <option value="">Select Client *</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="border rounded p-2" placeholder="Project Name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="border rounded p-2" placeholder="Default Rate ($/hr)" type="number" step="0.01" value={form.default_rate} onChange={(e) => setForm({ ...form, default_rate: e.target.value })} />
          <input className="border rounded p-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="md:col-span-2">
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">{editingId ? 'Update' : 'Create'}</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-center py-12">Loading...</p>
      ) : projects.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No projects yet.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Project</th>
                <th className="text-left p-3">Client</th>
                <th className="text-left p-3">Rate</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3">{p.client_name}</td>
                  <td className="p-3">${Number(p.default_rate).toFixed(2)}/hr</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${p.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-2">
                    <button onClick={() => startEdit(p)} className="text-indigo-600 hover:underline">Edit</button>
                    <button onClick={() => { if (confirm('Delete?')) remove.mutate(p.id); }} className="text-red-600 hover:underline">Delete</button>
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
