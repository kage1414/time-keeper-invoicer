import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { gql } from "../api/client";
import { Invoice, Client } from "../types";
import { useState } from "react";

const INVOICES_QUERY = `
  query($client_id: Int, $status: String) {
    invoices(client_id: $client_id, status: $status) {
      id client_id client_name invoice_number status
      issue_date due_date subtotal tax_rate tax_amount
      credits_applied total notes created_at updated_at
    }
  }
`;

const CLIENTS_QUERY = `query { clients { id name company } }`;

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
  cancelled: "bg-yellow-100 text-yellow-800",
};

export default function InvoicesPage() {
  const [filterClient, setFilterClient] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const vars: any = {};
  if (filterClient) vars.client_id = Number(filterClient);
  if (filterStatus) vars.status = filterStatus;

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["invoices", filterClient, filterStatus],
    queryFn: async () =>
      (await gql<{ invoices: Invoice[] }>(INVOICES_QUERY, vars)).invoices,
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: async () =>
      (await gql<{ clients: Client[] }>(CLIENTS_QUERY)).clients,
  });

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <Link
          to="/invoices/new"
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
        >
          Create Invoice
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          className="border rounded p-2 text-sm"
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
        >
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name || c.company}
            </option>
          ))}
        </select>
        <select
          className="border rounded p-2 text-sm"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-center py-12">Loading...</p>
      ) : invoices.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No invoices found.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Invoice #</th>
                  <th className="text-left p-3">Client</th>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Due</th>
                  <th className="text-right p-3">Billed</th>
                  <th className="text-right p-3">Credits</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t hover:bg-gray-50">
                    <td className="p-3">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="text-indigo-600 hover:underline font-medium"
                      >
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="p-3">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="text-indigo-600 hover:underline font-medium"
                      >
                        {inv.client_name}
                      </Link>
                    </td>
                    <td className="p-3">
                      {new Date(inv.issue_date).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      {new Date(inv.due_date).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      ${Number(inv.subtotal).toFixed(2)}
                    </td>
                    <td className="p-3 text-right">
                      {Number(inv.credits_applied) > 0
                        ? `-$${Number(inv.credits_applied).toFixed(2)}`
                        : "-"}
                    </td>
                    <td className="p-3 text-right font-medium">
                      ${Number(inv.total).toFixed(2)}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${statusColors[inv.status]}`}
                      >
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
