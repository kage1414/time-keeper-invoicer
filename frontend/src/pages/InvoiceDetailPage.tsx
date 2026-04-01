import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { gql } from "../api/client";
import { Invoice, UserSettings } from "../types";
import ConfirmModal from "../components/ConfirmModal";

const SETTINGS_QUERY = `query { userSettings { company first_name last_name email address1 address2 city state zip phone venmo cashapp paypal zelle smtp_host smtp_user } }`;

const INVOICE_QUERY = `
  query($id: Int!) {
    invoice(id: $id) {
      id client_id client_name client_company client_email client_address1 client_address2 client_city client_state client_zip
      invoice_number status issue_date due_date
      subtotal tax_rate tax_amount total notes
      line_items { id description quantity rate amount time_entry_id }
      created_at updated_at
    }
  }
`;

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
  cancelled: "bg-yellow-100 text-yellow-800",
};

const statusTransitions: Record<string, string[]> = {
  draft: ["sent", "cancelled"],
  sent: ["paid", "overdue", "cancelled"],
  overdue: ["paid", "cancelled"],
  paid: [],
  cancelled: ["draft"],
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [attachPdf, setAttachPdf] = useState(true);

  const { data: invoice, isLoading } = useQuery<Invoice>({
    queryKey: ["invoice", id],
    queryFn: async () =>
      (await gql<{ invoice: Invoice }>(INVOICE_QUERY, { id: Number(id) }))
        .invoice,
  });

  const { data: settings } = useQuery<UserSettings>({
    queryKey: ["userSettings"],
    queryFn: async () =>
      (await gql<{ userSettings: UserSettings }>(SETTINGS_QUERY)).userSettings,
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      gql(
        `mutation($id: Int!, $status: String!) { updateInvoiceStatus(id: $id, status: $status) { id } }`,
        { id: Number(id), status },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendInvoice = useMutation({
    mutationFn: async ({
      to,
      body,
      attachPdf,
    }: {
      to: string;
      body: string;
      attachPdf: boolean;
    }) => {
      let pdfBase64: string | null = null;
      if (attachPdf && invoice && settings) {
        pdfBase64 = await generatePdfBase64();
      }
      return gql(
        `mutation($id: Int!, $to: String!, $body: String, $pdfBase64: String) { sendInvoice(id: $id, to: $to, body: $body, pdfBase64: $pdfBase64) }`,
        { id: Number(id), to, body: body || null, pdfBase64 },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice sent");
      setShowSendModal(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteInvoice = useMutation({
    mutationFn: () =>
      gql(`mutation($id: Int!) { deleteInvoice(id: $id) }`, { id: Number(id) }),
    onSuccess: () => {
      toast.success("Invoice deleted");
      navigate("/invoices");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function buildInvoiceHtml() {
    if (!invoice) return "";
    const lineRows = (invoice.line_items || [])
      .map((li) => {
        const isCredit = Number(li.amount) < 0;
        const colorStyle = isCredit ? "color:#16a34a" : "";
        return `<tr${isCredit ? ' style="color:#16a34a"' : ""}>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;${colorStyle}">${(() => {
          const [first, ...rest] = li.description.split("\n");
          const dashIdx = first.indexOf(" - ");
          const name = dashIdx >= 0 ? first.slice(0, dashIdx) : first;
          const date = dashIdx >= 0 ? first.slice(dashIdx) : "";
          return `<strong>${name}</strong>${date}${rest.length ? "<br><em>" + rest.join("<br>") + "</em>" : ""}`;
        })()}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;${colorStyle}">${Number(li.quantity).toFixed(2)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;${colorStyle}">${isCredit ? `-$${Math.abs(Number(li.rate)).toFixed(2)}` : `$${Number(li.rate).toFixed(2)}`}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;${colorStyle}">${isCredit ? `-$${Math.abs(Number(li.amount)).toFixed(2)}` : `$${Number(li.amount).toFixed(2)}`}</td>
      </tr>`;
      })
      .join("");

    let totalsHtml = `
      <tr><td colspan="3" style="padding:8px;text-align:right;color:#6b7280">Subtotal</td>
        <td style="padding:8px;text-align:right">$${Number(invoice.subtotal).toFixed(2)}</td></tr>`;
    if (Number(invoice.tax_rate) > 0) {
      totalsHtml += `<tr><td colspan="3" style="padding:8px;text-align:right;color:#6b7280">Tax (${Number(invoice.tax_rate)}%)</td>
        <td style="padding:8px;text-align:right">$${Number(invoice.tax_amount).toFixed(2)}</td></tr>`;
    }
    totalsHtml += `<tr style="border-top:2px solid #111"><td colspan="3" style="padding:8px;text-align:right;font-weight:bold">Total:</td>
      <td style="padding:8px;text-align:right;font-weight:bold">$${Number(invoice.total).toFixed(2)}</td></tr>`;
    totalsHtml += `<tr><td colspan="3" style="padding:8px;text-align:right;font-weight:700;font-size:1.1em">Amount Due (USD):</td>
      <td style="padding:8px;text-align:right;font-weight:700;font-size:1.1em">$${Number(invoice.total).toFixed(2)}</td></tr>`;

    const fullName = settings
      ? [settings.first_name, settings.last_name].filter(Boolean).join(" ")
      : "";
    const cityStateZip = settings
      ? [settings.city, settings.state].filter(Boolean).join(", ") +
        (settings.zip ? ` ${settings.zip}` : "")
      : "";
    const paymentLines = [
      settings?.venmo ? `Venmo: ${settings.venmo}` : "",
      settings?.cashapp ? `Cash App: ${settings.cashapp}` : "",
      settings?.paypal ? `PayPal: ${settings.paypal}` : "",
      settings?.zelle ? `Zelle: ${settings.zelle}` : "",
    ].filter(Boolean);

    return `<!DOCTYPE html><html><head><title>Invoice ${invoice.invoice_number}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; color: #111; font-size: 14px; }
        h1 { margin: 0; font-size: 36px; text-transform: uppercase; letter-spacing: 2px; }
        table { width: 100%; border-collapse: collapse; }
        .line-table th { text-align: left; padding: 10px 8px; border-top: 2px solid #111; border-bottom: 2px solid #111; font-size: 13px; color: #111; }
        .line-table td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; }
        .details-table td { padding: 4px 12px; font-size: 14px; }
        @media print { body { margin: 20px; } }
      </style></head><body>

      <!-- Header: user info right-aligned, INVOICE title -->
      <div style="text-align:right;margin-bottom:32px">
        <h1>INVOICE</h1>
        ${paymentLines.length ? `<div style="margin:4px 0 16px;color:#6b7280;font-size:13px">${paymentLines.map((l) => `<p style="margin:2px 0">${l}</p>`).join("")}</div>` : '<div style="margin-bottom:16px"></div>'}
        ${settings?.company ? `<p style="margin:2px 0;font-weight:700;font-size:16px">${settings.company}</p>` : ""}
        ${fullName ? `<p style="margin:2px 0;font-weight:600">${fullName}</p>` : ""}
        ${settings?.address1 ? `<p style="margin:2px 0">${settings.address1}</p>` : ""}
        ${settings?.address2 ? `<p style="margin:2px 0">${settings.address2}</p>` : ""}
        ${cityStateZip ? `<p style="margin:2px 0">${cityStateZip}</p>` : ""}
        ${settings?.phone ? `<p style="margin:8px 0 0;color:#6b7280">${settings.phone}</p>` : ""}
        ${settings?.email ? `<p style="margin:2px 0;color:#6b7280">${settings.email}</p>` : ""}
      </div>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px" />

      <!-- Bill To + Invoice Details side by side -->
      <div style="display:flex;justify-content:space-between;margin-bottom:32px">
        <div>
          <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px">Bill To</p>
          ${invoice.client_company ? `<p style="margin:2px 0;font-weight:700">${invoice.client_company}</p>` : ""}
          <p style="margin:2px 0;font-weight:${invoice.client_company ? "500" : "600"}">${invoice.client_name}</p>
          ${invoice.client_address1 ? `<p style="margin:2px 0">${invoice.client_address1}</p>` : ""}
          ${invoice.client_address2 ? `<p style="margin:2px 0">${invoice.client_address2}</p>` : ""}
          ${invoice.client_city || invoice.client_state || invoice.client_zip ? `<p style="margin:2px 0">${[invoice.client_city, invoice.client_state].filter(Boolean).join(", ")}${invoice.client_zip ? ` ${invoice.client_zip}` : ""}</p>` : ""}
          ${invoice.client_email ? `<p style="margin:6px 0 0;color:#6b7280">${invoice.client_email}</p>` : ""}
        </div>
        <div style="text-align:right">
          <table class="details-table" style="margin-left:auto">
            <tr><td style="color:#6b7280;text-align:right">Invoice Number:</td><td style="text-align:right;font-weight:500">${invoice.invoice_number}</td></tr>
            <tr><td style="color:#6b7280;text-align:right">Invoice Date:</td><td style="text-align:right">${new Date(invoice.issue_date).toLocaleDateString()}</td></tr>
            <tr><td style="color:#6b7280;text-align:right">Payment Due:</td><td style="text-align:right">${new Date(invoice.issue_date).toDateString() === new Date(invoice.due_date).toDateString() ? "Upon Receipt" : new Date(invoice.due_date).toLocaleDateString()}</td></tr>
            <tr style="font-weight:600"><td style="padding-top:8px;text-align:right">Amount Due (USD):</td><td style="padding-top:8px;text-align:right">$${Number(invoice.total).toFixed(2)}</td></tr>
          </table>
        </div>
      </div>

      <!-- Line Items -->
      <table class="line-table">
        <thead><tr>
          <th>Services</th><th style="text-align:right">Hours</th>
          <th style="text-align:right">Rate</th><th style="text-align:right">Amount</th>
        </tr></thead>
        <tbody>${lineRows}</tbody>
        <tfoot>${totalsHtml}</tfoot>
      </table>

      ${invoice.notes ? `<div style="margin-top:32px"><p style="font-weight:600;margin-bottom:4px;color:#6b7280">Notes</p><p style="color:#374151;white-space:pre-wrap">${invoice.notes}</p></div>` : ""}
    </body></html>`;
  }

  function exportPdf() {
    const html = buildInvoiceHtml();
    if (!html) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.print();
  }

  async function generatePdfBase64(): Promise<string> {
    const { default: html2canvas } = await import("html2canvas");
    const { jsPDF } = await import("jspdf");
    const html = buildInvoiceHtml();
    const container = document.createElement("div");
    container.innerHTML = html
      .replace(/.*<body>/s, "")
      .replace(/<\/body>.*/s, "");
    container.style.cssText =
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:40px;color:#111;font-size:14px;position:absolute;left:-9999px;width:800px;';
    document.body.appendChild(container);
    try {
      const canvas = await html2canvas(container, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let y = margin;
      const usableHeight = pageHeight - margin * 2;
      if (imgHeight <= usableHeight) {
        pdf.addImage(imgData, "PNG", margin, y, imgWidth, imgHeight);
      } else {
        // Multi-page: slice the canvas into page-sized chunks
        let srcY = 0;
        const srcPageHeight = (canvas.width * usableHeight) / imgWidth;
        while (srcY < canvas.height) {
          const sliceHeight = Math.min(srcPageHeight, canvas.height - srcY);
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = canvas.width;
          pageCanvas.height = sliceHeight;
          const ctx = pageCanvas.getContext("2d")!;
          ctx.drawImage(
            canvas,
            0,
            srcY,
            canvas.width,
            sliceHeight,
            0,
            0,
            canvas.width,
            sliceHeight,
          );
          const pageImg = pageCanvas.toDataURL("image/png");
          const drawHeight = (sliceHeight * imgWidth) / canvas.width;
          pdf.addImage(pageImg, "PNG", margin, margin, imgWidth, drawHeight);
          srcY += sliceHeight;
          if (srcY < canvas.height) pdf.addPage();
        }
      }
      const arrayBuf = pdf.output("arraybuffer");
      const bytes = new Uint8Array(arrayBuf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++)
        binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    } finally {
      document.body.removeChild(container);
    }
  }

  function exportCsv() {
    if (!invoice) return;
    const rows = [["Description", "Quantity (hrs)", "Rate", "Amount"]];
    (invoice.line_items || []).forEach((li) => {
      rows.push([
        `"${li.description.replace(/"/g, '""')}"`,
        Number(li.quantity).toFixed(2),
        Number(li.rate).toFixed(2),
        Number(li.amount).toFixed(2),
      ]);
    });
    rows.push([]);
    rows.push(["Subtotal", "", "", Number(invoice.subtotal).toFixed(2)]);
    if (Number(invoice.tax_rate) > 0) {
      rows.push([
        `Tax (${Number(invoice.tax_rate)}%)`,
        "",
        "",
        Number(invoice.tax_amount).toFixed(2),
      ]);
    }
    rows.push(["Total", "", "", Number(invoice.total).toFixed(2)]);
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoice.invoice_number}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) return <div className="text-center py-12">Loading...</div>;
  if (!invoice)
    return <div className="text-center py-12">Invoice not found</div>;

  const nextStatuses = statusTransitions[invoice.status] || [];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link
            to="/invoices"
            className="text-indigo-600 hover:underline text-sm"
          >
            &larr; Back to Invoices
          </Link>
          <h1 className="text-2xl font-bold mt-1">
            Invoice {invoice.invoice_number}
          </h1>
        </div>
        <div className="flex gap-2">
          {settings?.smtp_host && settings?.smtp_user && (
            <button
              onClick={() => {
                setSendTo(invoice.client_email || "");
                const name = settings?.first_name
                  ? `${settings.first_name}${settings.last_name ? " " + settings.last_name : ""}`
                  : "";
                setSendBody(
                  `Hi ${invoice.client_name},\n\nPlease find attached invoice #${invoice.invoice_number} for $${Number(invoice.total).toFixed(2)}.\n\nPayment is due ${new Date(invoice.issue_date).toDateString() === new Date(invoice.due_date).toDateString() ? "upon receipt" : "by " + new Date(invoice.due_date).toLocaleDateString()}.\n\nThank you for your business!\n\n${name}`,
                );
                setShowSendModal(true);
              }}
              className="bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700"
            >
              Send Email
            </button>
          )}
          <button
            onClick={exportPdf}
            className="bg-gray-600 text-white px-3 py-2 rounded text-sm hover:bg-gray-700"
          >
            Export PDF
          </button>
          <button
            onClick={exportCsv}
            className="bg-gray-600 text-white px-3 py-2 rounded text-sm hover:bg-gray-700"
          >
            Export CSV
          </button>
          {nextStatuses.map((s) => (
            <button
              key={s}
              onClick={() => updateStatus.mutate(s)}
              className="bg-indigo-600 text-white px-3 py-2 rounded text-sm hover:bg-indigo-700 capitalize"
            >
              Mark {s}
            </button>
          ))}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-2">Invoice Details</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-gray-500">Status</dt>
            <dd>
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${statusColors[invoice.status]}`}
              >
                {invoice.status}
              </span>
            </dd>
            <dt className="text-gray-500">Issue Date</dt>
            <dd>{new Date(invoice.issue_date).toLocaleDateString()}</dd>
            <dt className="text-gray-500">Due Date</dt>
            <dd>
              {new Date(invoice.issue_date).toDateString() ===
              new Date(invoice.due_date).toDateString()
                ? "Upon Receipt"
                : new Date(invoice.due_date).toLocaleDateString()}
            </dd>
          </dl>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-2">Client</h2>
          {invoice.client_company && (
            <p className="font-medium">{invoice.client_company}</p>
          )}
          <p className={invoice.client_company ? "text-sm" : "font-medium"}>
            {invoice.client_name}
          </p>
          {invoice.client_email && (
            <p className="text-sm text-gray-500">{invoice.client_email}</p>
          )}
          {invoice.client_address1 && (
            <p className="text-sm text-gray-500">{invoice.client_address1}</p>
          )}
          {invoice.client_address2 && (
            <p className="text-sm text-gray-500">{invoice.client_address2}</p>
          )}
          {(invoice.client_city ||
            invoice.client_state ||
            invoice.client_zip) && (
            <p className="text-sm text-gray-500">
              {[invoice.client_city, invoice.client_state]
                .filter(Boolean)
                .join(", ")}
              {invoice.client_zip ? ` ${invoice.client_zip}` : ""}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="font-semibold mb-3">Line Items</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="pb-2">Description</th>
              <th className="pb-2 text-right">Qty (hrs)</th>
              <th className="pb-2 text-right">Rate</th>
              <th className="pb-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.line_items || []).map((li) => {
              const isCredit = Number(li.amount) < 0;
              const creditClass = isCredit ? " text-green-600" : "";
              return (
                <tr
                  key={li.id}
                  className={`border-b last:border-0${creditClass}`}
                >
                  <td className="py-2">
                    {(() => {
                      const [first, ...rest] = li.description.split("\n");
                      const dashIdx = first.indexOf(" - ");
                      const name =
                        dashIdx >= 0 ? first.slice(0, dashIdx) : first;
                      const date = dashIdx >= 0 ? first.slice(dashIdx) : "";
                      return (
                        <>
                          <span className="font-semibold">{name}</span>
                          {date && <span>{date}</span>}
                          {rest.length > 0 && (
                            <>
                              <br />
                              <span className="italic">{rest.join("\n")}</span>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </td>
                  <td className="py-2 text-right">
                    {Number(li.quantity).toFixed(2)}
                  </td>
                  <td className="py-2 text-right">
                    {isCredit
                      ? `-$${Math.abs(Number(li.rate)).toFixed(2)}`
                      : `$${Number(li.rate).toFixed(2)}`}
                  </td>
                  <td className="py-2 text-right">
                    {isCredit
                      ? `-$${Math.abs(Number(li.amount)).toFixed(2)}`
                      : `$${Number(li.amount).toFixed(2)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="border-t mt-4 pt-4 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-gray-500">Subtotal</span>
            <span>${Number(invoice.subtotal).toFixed(2)}</span>
          </div>
          {Number(invoice.tax_rate) > 0 && (
            <div className="flex justify-between py-1">
              <span className="text-gray-500">
                Tax ({Number(invoice.tax_rate)}%)
              </span>
              <span>${Number(invoice.tax_amount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between py-1 font-bold text-lg border-t mt-2 pt-2">
            <span>Total</span>
            <span>${Number(invoice.total).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {invoice.notes && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="font-semibold mb-2">Notes</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">
            {invoice.notes}
          </p>
        </div>
      )}

      {settings &&
        (settings.venmo ||
          settings.cashapp ||
          settings.paypal ||
          settings.zelle) && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <h2 className="font-semibold mb-2">Payment Methods</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {settings.venmo && (
                <div>
                  <span className="text-gray-500">Venmo:</span> {settings.venmo}
                </div>
              )}
              {settings.cashapp && (
                <div>
                  <span className="text-gray-500">Cash App:</span>{" "}
                  {settings.cashapp}
                </div>
              )}
              {settings.paypal && (
                <div>
                  <span className="text-gray-500">PayPal:</span>{" "}
                  {settings.paypal}
                </div>
              )}
              {settings.zelle && (
                <div>
                  <span className="text-gray-500">Zelle:</span> {settings.zelle}
                </div>
              )}
            </div>
          </div>
        )}

      <ConfirmModal
        open={showDeleteConfirm}
        message="Delete this invoice? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          setShowDeleteConfirm(false);
          deleteInvoice.mutate();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {showSendModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowSendModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-4">
              Send Invoice #{invoice.invoice_number}
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendInvoice.mutate({ to: sendTo, body: sendBody, attachPdf });
              }}
            >
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recipient Email
              </label>
              <input
                type="email"
                required
                className="border rounded p-2 w-full mb-4"
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
                placeholder="client@example.com"
              />
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Body
              </label>
              <textarea
                className="border rounded p-2 w-full mb-4 h-40 text-sm"
                value={sendBody}
                onChange={(e) => setSendBody(e.target.value)}
              />
              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={attachPdf}
                  onChange={(e) => setAttachPdf(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">
                  Attach invoice PDF
                </span>
              </label>
              <p className="text-xs text-gray-400 mb-4">
                The invoice details will be included below your message. Draft
                invoices will be marked as "sent" automatically.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSendModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendInvoice.isPending}
                  className="bg-green-600 text-white px-4 py-2 text-sm rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {sendInvoice.isPending
                    ? attachPdf
                      ? "Generating PDF & Sending..."
                      : "Sending..."
                    : "Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
