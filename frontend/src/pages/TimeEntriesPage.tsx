import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { gql } from "../api/client";
import { TimeEntry, Project, UserSettings } from "../types";
import ConfirmModal from "../components/ConfirmModal";

function ElapsedTime({ startTime, rate, showEarnings }: { startTime: string; rate?: number; showEarnings?: boolean }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.floor((now - new Date(startTime).getTime()) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  const earnings = rate != null ? (elapsed / 3600) * rate : null;

  return (
    <span className="font-mono text-green-700">
      {pad(h)}:{pad(m)}:{pad(s)}
      {showEarnings && earnings != null && (
        <span className="ml-2 text-green-600">${earnings.toFixed(2)}</span>
      )}
    </span>
  );
}

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const TIME_ENTRIES_QUERY = `
  query($project_id: Int, $unbilled: Boolean) {
    timeEntries(project_id: $project_id, unbilled: $unbilled) {
      id project_id project_name client_name client_id default_rate
      description start_time end_time duration_minutes is_billable
      invoice_id rate_override flat_amount created_at updated_at
    }
  }
`;

const PROJECTS_QUERY = `query { projects { id name client_name is_active } }`;
const USER_SETTINGS_QUERY = `query { userSettings { show_earnings_on_timer } }`;

interface StartModalState {
  open: boolean;
  useCurrentTime: boolean;
  projectId: string;
  description: string;
  rateOverride: string;
  startTime: string;
}

const emptyStartModal: StartModalState = {
  open: false,
  useCurrentTime: true,
  projectId: "",
  description: "",
  rateOverride: "",
  startTime: "",
};

interface EditModalState {
  open: boolean;
  id: number;
  projectId: string;
  description: string;
  rateOverride: string;
  startTime: string;
  endTime: string;
  isBillable: boolean;
}

const emptyEditModal: EditModalState = {
  open: false,
  id: 0,
  projectId: "",
  description: "",
  rateOverride: "",
  startTime: "",
  endTime: "",
  isBillable: true,
};

interface AddModalState {
  open: boolean;
  projectId: string;
  description: string;
  isTimeBased: boolean;
  startTime: string;
  endTime: string;
  rateOverride: string;
  flatAmount: string;
  isBillable: boolean;
}

const emptyAddModal: AddModalState = {
  open: false,
  projectId: "",
  description: "",
  isTimeBased: true,
  startTime: "",
  endTime: "",
  rateOverride: "",
  flatAmount: "",
  isBillable: true,
};

export default function TimeEntriesPage() {
  const qc = useQueryClient();
  const [filterProject, setFilterProject] = useState("");
  const [showUnbilled, setShowUnbilled] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [startModal, setStartModal] =
    useState<StartModalState>(emptyStartModal);
  const [editModal, setEditModal] = useState<EditModalState>(emptyEditModal);
  const [addModal, setAddModal] = useState<AddModalState>(emptyAddModal);

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () =>
      (await gql<{ projects: Project[] }>(PROJECTS_QUERY)).projects,
  });

  const { data: userSettings } = useQuery<Pick<UserSettings, 'show_earnings_on_timer'>>({
    queryKey: ["userSettings"],
    queryFn: async () =>
      (await gql<{ userSettings: Pick<UserSettings, 'show_earnings_on_timer'> }>(USER_SETTINGS_QUERY)).userSettings,
  });

  const vars: any = {};
  if (filterProject) vars.project_id = Number(filterProject);
  if (showUnbilled) vars.unbilled = true;

  const { data: entries = [], isLoading } = useQuery<TimeEntry[]>({
    queryKey: ["timeEntries", filterProject, showUnbilled],
    queryFn: async () =>
      (await gql<{ timeEntries: TimeEntry[] }>(TIME_ENTRIES_QUERY, vars))
        .timeEntries,
  });

  const startTimer = useMutation({
    mutationFn: () =>
      gql(
        `mutation($input: CreateTimeEntryInput!) { createTimeEntry(input: $input) { id } }`,
        {
          input: {
            project_id: Number(startModal.projectId),
            description: startModal.description || null,
            start_time: startModal.useCurrentTime
              ? new Date().toISOString()
              : new Date(startModal.startTime).toISOString(),
            is_billable: true,
            rate_override: startModal.rateOverride
              ? Number(startModal.rateOverride)
              : null,
          },
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timeEntries"] });
      toast.success("Timer started");
      setStartModal(emptyStartModal);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addEntry = useMutation({
    mutationFn: () =>
      gql(
        `mutation($input: CreateTimeEntryInput!) { createTimeEntry(input: $input) { id } }`,
        {
          input: {
            project_id: Number(addModal.projectId),
            description: addModal.description || null,
            start_time: addModal.isTimeBased && addModal.startTime ? new Date(addModal.startTime).toISOString() : null,
            end_time: addModal.isTimeBased && addModal.endTime ? new Date(addModal.endTime).toISOString() : null,
            is_billable: addModal.isBillable,
            rate_override: addModal.isTimeBased && addModal.rateOverride ? Number(addModal.rateOverride) : null,
            flat_amount: !addModal.isTimeBased && addModal.flatAmount ? Number(addModal.flatAmount) : null,
          },
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timeEntries"] });
      toast.success("Time entry added");
      setAddModal(emptyAddModal);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateEntry = useMutation({
    mutationFn: () =>
      gql(
        `mutation($id: Int!, $input: UpdateTimeEntryInput!) { updateTimeEntry(id: $id, input: $input) { id } }`,
        {
          id: editModal.id,
          input: {
            project_id: Number(editModal.projectId),
            description: editModal.description || null,
            start_time: new Date(editModal.startTime).toISOString(),
            end_time: editModal.endTime
              ? new Date(editModal.endTime).toISOString()
              : null,
            is_billable: editModal.isBillable,
            rate_override: editModal.rateOverride
              ? Number(editModal.rateOverride)
              : null,
          },
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timeEntries"] });
      toast.success("Entry updated");
      setEditModal(emptyEditModal);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stopTimer = useMutation({
    mutationFn: (id: number) =>
      gql(`mutation($id: Int!) { stopTimeEntry(id: $id) { id } }`, { id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timeEntries"] });
      toast.success("Timer stopped");
    },
  });

  const removeEntry = useMutation({
    mutationFn: (id: number) =>
      gql(`mutation($id: Int!) { deleteTimeEntry(id: $id) }`, { id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timeEntries"] });
      toast.success("Entry deleted");
    },
  });

  const creditEntry = useMutation({
    mutationFn: (id: number) =>
      gql(`mutation($id: Int!) { creditTimeEntry(id: $id) { id } }`, { id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credits"] });
      toast.success("Credit created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restartEntry = useMutation({
    mutationFn: ({
      id,
    }: {
      id: number;
      name: string;
      desc: string;
      duration: string;
    }) =>
      gql(`mutation($id: Int!) { restartTimeEntry(id: $id) { id } }`, { id }),
    onSuccess: (_data, { name, desc, duration }) => {
      qc.invalidateQueries({ queryKey: ["timeEntries"] });
      toast.success(
        `Restarted: ${name}${desc ? ` - ${desc}` : ""} (was ${duration})`,
        { duration: 4000 },
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h ${m}m`;
  }

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  function openEditModal(e: TimeEntry) {
    setEditModal({
      open: true,
      id: e.id,
      projectId: String(e.project_id),
      description: e.description || "",
      rateOverride: e.rate_override ? String(e.rate_override) : "",
      startTime: e.start_time ? toLocalDatetime(e.start_time) : "",
      endTime: e.end_time ? toLocalDatetime(e.end_time) : "",
      isBillable: e.is_billable,
    });
  }

  const running = entries.filter((e) => !e.end_time);
  const completed = entries.filter((e) => e.end_time);
  const hasRunning = running.length > 0;

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Time Tracking</h1>
        <div className="flex gap-2">
          <button
            onClick={() =>
              setAddModal({
                ...emptyAddModal,
                open: true,
                startTime: toLocalDatetime(new Date().toISOString()),
                endTime: toLocalDatetime(new Date().toISOString()),
              })
            }
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >
            Add Entry
          </button>
          <button
            onClick={() =>
              setStartModal({
                ...emptyStartModal,
                open: true,
                startTime: toLocalDatetime(new Date().toISOString()),
              })
            }
            disabled={hasRunning || addModal.open}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start Timer
          </button>
        </div>
      </div>

      {/* Running Timers */}
      {running.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3 text-green-800">
            Running Timers
          </h2>
          {running.map((e) => (
            <div
              key={e.id}
              className="flex justify-between items-center py-2 border-b border-green-200 last:border-0"
            >
              <div>
                <span className="font-medium">{e.project_name}</span>
                {e.description && (
                  <span className="text-gray-600 ml-2">- {e.description}</span>
                )}
                <span className="text-sm text-gray-500 ml-2">
                  Started: {e.start_time ? formatTime(e.start_time) : "—"}
                </span>
                <span className="ml-3">
                  <ElapsedTime
                    startTime={e.start_time ?? new Date().toISOString()}
                    rate={e.rate_override ?? e.default_rate}
                    showEarnings={userSettings?.show_earnings_on_timer}
                  />
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => openEditModal(e)}
                  className="text-indigo-600 hover:underline text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => stopTimer.mutate(e.id)}
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                >
                  Stop
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          className="border rounded p-2 text-sm"
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showUnbilled}
            onChange={(e) => setShowUnbilled(e.target.checked)}
          />
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
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Project</th>
                  <th className="text-left p-3">Description</th>
                  <th className="text-left p-3">Start</th>
                  <th className="text-left p-3">End</th>
                  <th className="text-left p-3">Duration</th>
                  <th className="text-left p-3">Rate</th>
                  <th className="text-left p-3">Amount</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...completed].sort((a, b) => new Date(b.start_time ?? 0).getTime() - new Date(a.start_time ?? 0).getTime()).map((e) => {
                  const isFlat = e.flat_amount != null;
                  const rate = e.rate_override ?? e.default_rate;
                  const amount = isFlat ? Number(e.flat_amount) : (e.duration_minutes / 60) * Number(rate);
                  return (
                    <tr key={e.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-medium">{e.project_name}</td>
                      <td className="p-3 max-w-[160px] truncate" title={e.description || ""}>{e.description || "-"}</td>
                      <td className="p-3">{e.start_time ? formatTime(e.start_time) : "—"}</td>
                      <td className="p-3">{e.end_time ? formatTime(e.end_time) : "—"}</td>
                      <td className="p-3">{isFlat ? "—" : formatDuration(e.duration_minutes)}</td>
                      <td className="p-3">{isFlat ? "—" : `$${Number(rate).toFixed(2)}/hr`}</td>
                      <td className="p-3">${amount.toFixed(2)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${e.invoice_id ? "bg-green-100 text-green-800" : !e.is_billable ? "bg-slate-100 text-slate-600" : "bg-yellow-100 text-yellow-800"}`}>
                          {e.invoice_id ? "Billed" : !e.is_billable ? "Not Billable" : "Unbilled"}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button onClick={() => openEditModal(e)} className="text-indigo-600 hover:underline text-sm">Edit</button>
                        {e.duration_minutes > 0 && (
                          <button onClick={() => setConfirmAction({ message: `Create a $${amount.toFixed(2)} credit for this entry?`, onConfirm: () => creditEntry.mutate(e.id) })} className="text-green-600 hover:underline text-sm">Credit</button>
                        )}
                        {!e.invoice_id && (
                          <button onClick={() => setConfirmAction({ message: "Delete this time entry?", onConfirm: () => removeEntry.mutate(e.id) })} className="text-red-600 hover:underline text-sm">Delete</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y">
            {[...completed].sort((a, b) => new Date(b.start_time ?? 0).getTime() - new Date(a.start_time ?? 0).getTime()).map((e) => {
              const isFlat = e.flat_amount != null;
              const rate = e.rate_override ?? e.default_rate;
              const amount = isFlat ? Number(e.flat_amount) : (e.duration_minutes / 60) * Number(rate);
              const tooltip = [
                e.description ? `Description: ${e.description}` : null,
                e.start_time ? `Start: ${formatTime(e.start_time)}` : null,
                e.end_time ? `End: ${formatTime(e.end_time)}` : null,
                !isFlat ? `Rate: $${Number(rate).toFixed(2)}/hr` : null,
                !isFlat ? `Duration: ${formatDuration(e.duration_minutes)}` : null,
                `Client: ${e.client_name}`,
              ].filter(Boolean).join("\n");
              return (
                <div key={e.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-sm truncate">{e.project_name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${e.invoice_id ? "bg-green-100 text-green-800" : !e.is_billable ? "bg-slate-100 text-slate-600" : "bg-yellow-100 text-yellow-800"}`}>
                          {e.invoice_id ? "Billed" : !e.is_billable ? "Not Billable" : "Unbilled"}
                        </span>
                        <button
                          title={tooltip}
                          className="text-gray-400 hover:text-gray-600 shrink-0"
                          onClick={(ev) => { ev.preventDefault(); alert(tooltip); }}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      </div>
                      {e.description && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{e.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>{e.start_time ? new Date(e.start_time).toLocaleDateString() : "—"}</span>
                        <span className="font-medium text-gray-700">{isFlat ? "Flat" : formatDuration(e.duration_minutes)}</span>
                        <span className="font-semibold text-gray-900">${amount.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 text-xs">
                      <button onClick={() => openEditModal(e)} className="text-indigo-600 hover:underline">Edit</button>
                      {e.duration_minutes > 0 && (
                        <button onClick={() => setConfirmAction({ message: `Create a $${amount.toFixed(2)} credit for this entry?`, onConfirm: () => creditEntry.mutate(e.id) })} className="text-green-600 hover:underline">Credit</button>
                      )}
                      {!e.invoice_id && (
                        <button onClick={() => setConfirmAction({ message: "Delete this time entry?", onConfirm: () => removeEntry.mutate(e.id) })} className="text-red-600 hover:underline">Delete</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Start Timer Modal */}
      {startModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setStartModal(emptyStartModal)}
          />
          <div className="relative bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Start Timer</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                startTimer.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project *
                </label>
                <select
                  className="border rounded p-2 w-full"
                  required
                  value={startModal.projectId}
                  onChange={(e) =>
                    setStartModal({ ...startModal, projectId: e.target.value })
                  }
                >
                  <option value="">Select Project</option>
                  {projects
                    .filter((p) => p.is_active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.client_name})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  className="border rounded p-2 w-full"
                  value={startModal.description}
                  onChange={(e) =>
                    setStartModal({
                      ...startModal,
                      description: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rate Override ($/hr)
                </label>
                <input
                  className="border rounded p-2 w-full"
                  type="number"
                  step="0.01"
                  value={startModal.rateOverride}
                  onChange={(e) =>
                    setStartModal({
                      ...startModal,
                      rateOverride: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time
                </label>
                <div className="flex gap-3 mb-2">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      checked={startModal.useCurrentTime}
                      onChange={() =>
                        setStartModal({ ...startModal, useCurrentTime: true })
                      }
                    />
                    Use current time
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      checked={!startModal.useCurrentTime}
                      onChange={() =>
                        setStartModal({ ...startModal, useCurrentTime: false })
                      }
                    />
                    Set manually
                  </label>
                </div>
                {!startModal.useCurrentTime && (
                  <input
                    className="border rounded p-2 w-full"
                    type="datetime-local"
                    required
                    value={startModal.startTime}
                    onChange={(e) =>
                      setStartModal({
                        ...startModal,
                        startTime: e.target.value,
                      })
                    }
                  />
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStartModal(emptyStartModal)}
                  className="px-4 py-2 rounded text-sm border border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700"
                >
                  Start
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Entry Modal */}
      {editModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setEditModal(emptyEditModal)}
          />
          <div className="relative bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Edit Time Entry</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editModal.endTime && new Date(editModal.endTime) <= new Date(editModal.startTime)) {
                  toast.error('End time must be after start time');
                  return;
                }
                updateEntry.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project *
                </label>
                <select
                  className="border rounded p-2 w-full"
                  required
                  value={editModal.projectId}
                  onChange={(e) =>
                    setEditModal({ ...editModal, projectId: e.target.value })
                  }
                >
                  <option value="">Select Project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.client_name})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  className="border rounded p-2 w-full"
                  value={editModal.description}
                  onChange={(e) =>
                    setEditModal({ ...editModal, description: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time *
                </label>
                <input
                  className="border rounded p-2 w-full"
                  type="datetime-local"
                  required
                  value={editModal.startTime}
                  onChange={(e) =>
                    setEditModal({ ...editModal, startTime: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  className="border rounded p-2 w-full"
                  type="datetime-local"
                  value={editModal.endTime}
                  onChange={(e) =>
                    setEditModal({ ...editModal, endTime: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rate Override ($/hr)
                </label>
                <input
                  className="border rounded p-2 w-full"
                  type="number"
                  step="0.01"
                  value={editModal.rateOverride}
                  onChange={(e) =>
                    setEditModal({ ...editModal, rateOverride: e.target.value })
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editModal.isBillable}
                  onChange={(e) =>
                    setEditModal({ ...editModal, isBillable: e.target.checked })
                  }
                />
                Billable
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModal(emptyEditModal)}
                  className="px-4 py-2 rounded text-sm border border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Entry Modal */}
      {addModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setAddModal(emptyAddModal)}
          />
          <div className="relative bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Add Entry</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (addModal.isTimeBased && addModal.startTime && addModal.endTime &&
                    new Date(addModal.endTime) <= new Date(addModal.startTime)) {
                  toast.error('End time must be after start time');
                  return;
                }
                addEntry.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
                <select
                  className="border rounded p-2 w-full"
                  required
                  value={addModal.projectId}
                  onChange={(e) => setAddModal({ ...addModal, projectId: e.target.value })}
                >
                  <option value="">Select Project</option>
                  {projects.filter((p) => p.is_active).map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.client_name})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  className="border rounded p-2 w-full"
                  value={addModal.description}
                  onChange={(e) => setAddModal({ ...addModal, description: e.target.value })}
                />
              </div>
              {/* Time-based toggle */}
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={addModal.isTimeBased}
                  onChange={(e) => setAddModal({ ...addModal, isTimeBased: e.target.checked })}
                />
                Time-based entry
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <input
                  className="border rounded p-2 w-full"
                  type="datetime-local"
                  value={addModal.startTime}
                  onChange={(e) => setAddModal({ ...addModal, startTime: e.target.value })}
                />
              </div>
              {addModal.isTimeBased && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    className="border rounded p-2 w-full"
                    type="datetime-local"
                    value={addModal.endTime}
                    onChange={(e) => setAddModal({ ...addModal, endTime: e.target.value })}
                  />
                </div>
              )}
              {addModal.isTimeBased ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rate ($/hr)</label>
                  <input
                    className="border rounded p-2 w-full"
                    type="number"
                    step="0.01"
                    placeholder="Leave blank to use project default"
                    value={addModal.rateOverride}
                    onChange={(e) => setAddModal({ ...addModal, rateOverride: e.target.value })}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($) *</label>
                  <input
                    className="border rounded p-2 w-full"
                    type="number"
                    step="0.01"
                    required
                    value={addModal.flatAmount}
                    onChange={(e) => setAddModal({ ...addModal, flatAmount: e.target.value })}
                  />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={addModal.isBillable}
                  onChange={(e) => setAddModal({ ...addModal, isBillable: e.target.checked })}
                />
                Billable
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAddModal(emptyAddModal)}
                  className="px-4 py-2 rounded text-sm border border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700"
                >
                  Add Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmAction}
        message={confirmAction?.message || ""}
        confirmLabel="Yes"
        onConfirm={() => {
          confirmAction?.onConfirm();
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
