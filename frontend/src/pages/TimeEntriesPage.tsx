import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { TimeEntry, Project } from '../types';

export default function TimeEntriesPage() {
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState('');
  const [description, setDescription] = useState('');
  const [rateOverride, setRateOverride] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [showUnbilled, setShowUnbilled] = useState(false);

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects'),
  });

  const queryParams = new URLSearchParams();
  if (filterProject) queryParams.set('project_id', filterProject);
  if (showUnbilled) queryParams.set('unbilled', 'true');
  const qs = queryParams.toString();

  const { data: entries = [], isLoading } = useQuery<TimeEntry[]>({
    queryKey: ['timeEntries', qs],
    queryFn: () => api.get(`/time-entries${qs ? `?${qs}` : ''}`),
  });

  const startTimer = useMutation({
    mutationFn: () =>
      api.post('/time-entries', {
        project_id: Number(projectId),
        description,
        is_billable: true,
        rate_override: rateOverride ? Number(rateOverride) : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timeEntries'] });
      toast.success('Timer started');
      setDescription('');
      setRateOverride('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stopTimer = useMutation({
    mutationFn: (id: number) => api.post(`/time-entries/${id}/stop`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timeEntries'] });
      toast.success('Timer stopped');
    },
  });

  const removeEntry = useMutation({
    mutationFn: (id: number) => api.del(`/time-entries/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timeEntries'] });
      toast.success('Entry deleted');
    },
  });

  function formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h ${m}m`;
  }

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  const running = entries.filter((e) => !e.end_time);
  const completed = entries.filter((e) => e.end_time);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Time Tracking</h1>

      {/* Start Timer */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Start Timer</h2>
        <form
          onSubmit={(e) => { e.preventDefault(); startTimer.mutate(); }}
          className="grid grid-cols-1 md:grid-cols-4 gap-3"
        >
          <select className="border rounded p-2" required value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Select Project *</option>
            {projects.filter((p) => p.is_active).map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.client_name})</option>
            ))}
          </select>
          <input className="border rounded p-2" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <input className="border rounded p-2" placeholder="Rate override ($/hr)" type="number" step="0.01" value={rateOverride} onChange={(e) => setRateOverride(e.target.value)} />
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Start</button>
        </form>
      </div>

      {/* Running Timers */}
      {running.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3 text-green-800">Running Timers</h2>
          {running.map((e) => (
            <div key={e.id} className="flex justify-between items-center py-2 border-b border-green-200 last:border-0">
              <div>
                <span className="font-medium">{e.project_name}</span>
                {e.description && <span className="text-gray-600 ml-2">- {e.description}</span>}
                <span className="text-sm text-gray-500 ml-2">Started: {formatTime(e.start_time)}</span>
              </div>
              <button onClick={() => stopTimer.mutate(e.id)} className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">Stop</button>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select className="border rounded p-2 text-sm" value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showUnbilled} onChange={(e) => setShowUnbilled(e.target.checked)} />
          Unbilled only
        </label>
      </div>

      {/* Completed Entries */}
      {isLoading ? (
        <p className="text-center py-12">Loading...</p>
      ) : completed.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No time entries found.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Project</th>
                <th className="text-left p-3">Description</th>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Duration</th>
                <th className="text-left p-3">Rate</th>
                <th className="text-left p-3">Amount</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {completed.map((e) => {
                const rate = e.rate_override ?? e.default_rate;
                const amount = (e.duration_minutes / 60) * Number(rate);
                return (
                  <tr key={e.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-medium">{e.project_name}</td>
                    <td className="p-3">{e.description || '-'}</td>
                    <td className="p-3">{new Date(e.start_time).toLocaleDateString()}</td>
                    <td className="p-3">{formatDuration(e.duration_minutes)}</td>
                    <td className="p-3">${Number(rate).toFixed(2)}/hr</td>
                    <td className="p-3">${amount.toFixed(2)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${e.invoice_id ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {e.invoice_id ? 'Billed' : 'Unbilled'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {!e.invoice_id && (
                        <button onClick={() => { if (confirm('Delete?')) removeEntry.mutate(e.id); }} className="text-red-600 hover:underline text-sm">Delete</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
