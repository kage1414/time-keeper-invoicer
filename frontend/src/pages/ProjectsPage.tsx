import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { gql } from "../api/client";
import { Project, Client } from "../types";
import ConfirmModal from "../components/ConfirmModal";

const PROJECTS_QUERY = `query { projects { id client_id client_name name description default_rate is_active created_at updated_at } }`;
const CLIENTS_QUERY = `query { clients { id name company } }`;

interface ProjectForm {
  client_id: string;
  name: string;
  description: string;
  default_rate: string;
  is_active: boolean;
}

const emptyForm: ProjectForm = {
  client_id: "",
  name: "",
  description: "",
  default_rate: "85",
  is_active: true,
};

function EditProjectModal({
  project,
  clients,
  onClose,
}: {
  project: Project | null;
  clients: Client[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ProjectForm>(
    project
      ? {
          client_id: String(project.client_id),
          name: project.name,
          description: project.description || "",
          default_rate: String(project.default_rate),
          is_active: project.is_active,
        }
      : emptyForm
  );

  const set = <K extends keyof ProjectForm>(field: K, value: ProjectForm[K]) =>
    setForm((f) => ({ ...f, [field]: value }));

  const save = useMutation({
    mutationFn: () => {
      const body = {
        client_id: Number(form.client_id),
        name: form.name,
        description: form.description,
        default_rate: Number(form.default_rate),
        ...(project ? { is_active: form.is_active } : {}),
      };
      if (project) {
        return gql(
          `mutation($id: Int!, $input: UpdateProjectInput!) { updateProject(id: $id, input: $input) { id } }`,
          { id: project.id, input: body }
        );
      }
      return gql(
        `mutation($input: CreateProjectInput!) { createProject(input: $input) { id } }`,
        { input: body }
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success(project ? "Project updated" : "Project created");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{project ? "Edit Project" : "New Project"}</h2>
          {project && (
            <button
              onClick={() => set("is_active", !form.is_active)}
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                form.is_active
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${form.is_active ? "bg-green-500" : "bg-gray-400"}`} />
              {form.is_active ? "Active" : "Inactive"}
            </button>
          )}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
          className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
            <select
              className="border rounded p-2 w-full"
              required
              value={form.client_id}
              onChange={(e) => set("client_id", e.target.value)}
            >
              <option value="">Select Client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name || c.company}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
            <input
              className="border rounded p-2 w-full"
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Rate ($/hr)</label>
            <input
              className="border rounded p-2 w-full"
              type="number"
              step="1"
              value={form.default_rate}
              onChange={(e) => set("default_rate", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              className="border rounded p-2 w-full"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t">
            <button type="button" onClick={onClose} className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300">
              Cancel
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Project | null | undefined>(undefined);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => (await gql<{ projects: Project[] }>(PROJECTS_QUERY)).projects,
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: async () => (await gql<{ clients: Client[] }>(CLIENTS_QUERY)).clients,
  });

  const remove = useMutation({
    mutationFn: (id: number) =>
      gql(`mutation($id: Int!) { deleteProject(id: $id) }`, { id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted");
    },
  });

  const visibleProjects = showInactive ? projects : projects.filter((p) => p.is_active);

  if (isLoading) return <p className="text-center py-12">Loading...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            Show inactive
          </label>
          <button
            onClick={() => setEditing(null)}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >
            Add Project
          </button>
        </div>
      </div>

      {visibleProjects.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No projects.</p>
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
              {visibleProjects.map((p) => (
                <tr key={p.id} className={`border-t hover:bg-gray-50 ${!p.is_active ? "opacity-50" : ""}`}>
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3">{p.client_name}</td>
                  <td className="p-3">${Number(p.default_rate).toFixed(2)}/hr</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${p.is_active ? "bg-green-500" : "bg-gray-400"}`} />
                      {p.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-2">
                    <button onClick={() => setEditing(p)} className="text-indigo-600 hover:underline">Edit</button>
                    <button onClick={() => setConfirmDeleteId(p.id)} className="text-red-600 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing !== undefined && (
        <EditProjectModal
          project={editing}
          clients={clients}
          onClose={() => setEditing(undefined)}
        />
      )}

      <ConfirmModal
        open={confirmDeleteId !== null}
        message="Delete this project?"
        confirmLabel="Delete"
        onConfirm={() => { if (confirmDeleteId !== null) remove.mutate(confirmDeleteId); setConfirmDeleteId(null); }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
