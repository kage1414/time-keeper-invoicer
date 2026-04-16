import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { gql } from '../api/client';
import { UserSettings, User } from '../types';
import { useAuth } from '../auth/AuthContext';

const SETTINGS_FIELDS = 'id company first_name last_name email address1 address2 city state zip phone venmo cashapp paypal zelle default_due_days smtp_host smtp_port smtp_user smtp_pass smtp_secure smtp_from_email smtp_from_name default_email_template show_earnings_on_timer';

const SETTINGS_QUERY = `query { userSettings { ${SETTINGS_FIELDS} } }`;

const UPDATE_SETTINGS_MUTATION = `
  mutation($input: UpdateUserSettingsInput!) {
    updateUserSettings(input: $input) { ${SETTINGS_FIELDS} }
  }
`;

const USERS_QUERY = `query { users { id email name role created_at } }`;

export default function SettingsPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [company, setCompany] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [phone, setPhone] = useState('');
  const [venmo, setVenmo] = useState('');
  const [cashapp, setCashapp] = useState('');
  const [paypal, setPaypal] = useState('');
  const [zelle, setZelle] = useState('');
  const [defaultDueDays, setDefaultDueDays] = useState('30');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [smtpFromEmail, setSmtpFromEmail] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('');
  const [emailTemplate, setEmailTemplate] = useState('');
  const [showEarningsOnTimer, setShowEarningsOnTimer] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const { data: settings } = useQuery<UserSettings>({
    queryKey: ['userSettings'],
    queryFn: async () => (await gql<{ userSettings: UserSettings }>(SETTINGS_QUERY)).userSettings,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => (await gql<{ users: User[] }>(USERS_QUERY)).users,
    enabled: isAdmin,
  });

  useEffect(() => {
    if (settings) {
      setCompany(settings.company || '');
      setFirstName(settings.first_name || '');
      setLastName(settings.last_name || '');
      setEmail(settings.email || '');
      setAddress1(settings.address1 || '');
      setAddress2(settings.address2 || '');
      setCity(settings.city || '');
      setState(settings.state || '');
      setZip(settings.zip || '');
      setPhone(settings.phone || '');
      setVenmo(settings.venmo || '');
      setCashapp(settings.cashapp || '');
      setPaypal(settings.paypal || '');
      setZelle(settings.zelle || '');
      setDefaultDueDays(String(settings.default_due_days ?? 30));
      setSmtpHost(settings.smtp_host || '');
      setSmtpPort(String(settings.smtp_port || 587));
      setSmtpUser(settings.smtp_user || '');
      setSmtpPass(settings.smtp_pass || '');
      setSmtpSecure(settings.smtp_secure ?? true);
      setSmtpFromEmail(settings.smtp_from_email || '');
      setSmtpFromName(settings.smtp_from_name || '');
      setEmailTemplate(settings.default_email_template || '');
      setShowEarningsOnTimer(settings.show_earnings_on_timer ?? false);
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: () =>
      gql(UPDATE_SETTINGS_MUTATION, {
        input: {
          company: company || null,
          first_name: firstName || null,
          last_name: lastName || null,
          email: email || null,
          address1: address1 || null,
          address2: address2 || null,
          city: city || null,
          state: state || null,
          zip: zip || null,
          phone: phone || null,
          venmo: venmo || null,
          cashapp: cashapp || null,
          paypal: paypal || null,
          zelle: zelle || null,
          default_due_days: defaultDueDays ? Number(defaultDueDays) : null,
          smtp_host: smtpHost || null,
          smtp_port: smtpPort ? Number(smtpPort) : null,
          smtp_user: smtpUser || null,
          smtp_pass: smtpPass || null,
          smtp_secure: smtpSecure,
          smtp_from_email: smtpFromEmail || null,
          smtp_from_name: smtpFromName || null,
          default_email_template: emailTemplate || null,
          show_earnings_on_timer: showEarningsOnTimer,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['userSettings'] });
      toast.success('Settings saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testSmtp = useMutation({
    mutationFn: async () => {
      await save.mutateAsync();
      return gql(
        `mutation($host: String!, $port: Int!, $user: String!, $pass: String!, $secure: Boolean!) { testSmtp(host: $host, port: $port, user: $user, pass: $pass, secure: $secure) }`,
        { host: smtpHost, port: Number(smtpPort) || 587, user: smtpUser, pass: smtpPass, secure: smtpSecure }
      );
    },
    onSuccess: () => toast.success('SMTP connection successful!'),
    onError: (e: Error) => toast.error(`SMTP test failed: ${e.message}`),
  });

  const changePassword = useMutation({
    mutationFn: () =>
      gql('mutation($currentPassword: String!, $newPassword: String!) { changePassword(currentPassword: $currentPassword, newPassword: $newPassword) }',
        { currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      toast.success('Password changed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    changePassword.mutate();
  };

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) =>
      gql('mutation($id: Int!, $role: String!) { updateUserRole(id: $id, role: $role) { id role } }',
        { id, role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Role updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-4">Personal Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <input className="border rounded p-2 w-full" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input className="border rounded p-2 w-full" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input className="border rounded p-2 w-full" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input className="border rounded p-2 w-full" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input className="border rounded p-2 w-full" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
              <input className="border rounded p-2 w-full" value={address1} onChange={(e) => setAddress1(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
              <input className="border rounded p-2 w-full" value={address2} onChange={(e) => setAddress2(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input className="border rounded p-2 w-full" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input className="border rounded p-2 w-full" value={state} onChange={(e) => setState(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zip</label>
              <input className="border rounded p-2 w-full" value={zip} onChange={(e) => setZip(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-4">Online Payment Methods</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Venmo</label>
              <input className="border rounded p-2 w-full" placeholder="@username" value={venmo} onChange={(e) => setVenmo(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cash App</label>
              <input className="border rounded p-2 w-full" placeholder="$cashtag" value={cashapp} onChange={(e) => setCashapp(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PayPal</label>
              <input className="border rounded p-2 w-full" placeholder="email or username" value={paypal} onChange={(e) => setPaypal(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zelle</label>
              <input className="border rounded p-2 w-full" placeholder="email or phone" value={zelle} onChange={(e) => setZelle(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-4">Display</h2>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showEarningsOnTimer}
              onChange={(e) => setShowEarningsOnTimer(e.target.checked)}
            />
            Show dollar amount on running timers
          </label>
          <p className="text-xs text-gray-400 mt-1">Display live earnings next to the elapsed time counter based on the project rate.</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-4">Invoice Defaults</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Due In (days)</label>
              <input className="border rounded p-2 w-full" type="number" min="0" value={defaultDueDays}
                onChange={(e) => setDefaultDueDays(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Set to 0 for "Upon Receipt"</p>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Email Template</label>
            <textarea className="border rounded p-2 w-full h-40 text-sm font-mono" value={emailTemplate}
              onChange={(e) => setEmailTemplate(e.target.value)}
              placeholder={`Hi {{client_name}},\n\nPlease find attached invoice #{{invoice_number}} for \${{total}}.\n\nPayment is due {{due_date}}.\n\nThank you for your business!\n\n{{your_name}}`} />
            <p className="text-xs text-gray-400 mt-1">
              Available variables: {'{{client_name}}'}, {'{{client_first_name}}'}, {'{{client_last_name}}'}, {'{{invoice_number}}'}, {'{{total}}'}, {'{{due_date}}'}, {'{{your_name}}'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Email (SMTP)</h2>
            <button type="button" onClick={() => {
              setSmtpHost('smtp.gmail.com');
              setSmtpPort('587');
              setSmtpSecure(false);
            }} className="text-sm text-indigo-600 hover:underline">
              Use Gmail
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-4">Configure SMTP to send invoices by email. For Gmail, use an App Password (Google Account &rarr; Security &rarr; App Passwords).</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
              <input className="border rounded p-2 w-full" placeholder="smtp.gmail.com" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
              <input className="border rounded p-2 w-full" type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username / Email</label>
              <input className="border rounded p-2 w-full" placeholder="you@gmail.com" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password / App Password</label>
              <input className="border rounded p-2 w-full" type="password" placeholder="App Password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
              <input className="border rounded p-2 w-full" placeholder="Your Name" value={smtpFromName} onChange={(e) => setSmtpFromName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
              <input className="border rounded p-2 w-full" placeholder="you@gmail.com" value={smtpFromEmail} onChange={(e) => setSmtpFromEmail(e.target.value)} />
            </div>
            <div className="flex items-center space-x-2">
              <input type="checkbox" id="smtpSecure" checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} />
              <label htmlFor="smtpSecure" className="text-sm text-gray-700">Use SSL/TLS (port 465). Uncheck for STARTTLS (port 587).</label>
            </div>
          </div>
          <button type="button" onClick={() => testSmtp.mutate()}
            disabled={testSmtp.isPending}
            className="mt-4 bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-700 disabled:opacity-50">
            {testSmtp.isPending ? 'Testing...' : 'Test Connection'}
          </button>
        </div>

        <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700">
          Save Settings
        </button>
      </form>

      <form onSubmit={handleChangePassword} className="mt-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-4">Change Password</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input type="password" required className="border rounded p-2 w-full" value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input type="password" required className="border rounded p-2 w-full" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Minimum 8 characters</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input type="password" required className="border rounded p-2 w-full" value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700">
            Change Password
          </button>
        </div>
      </form>

      {isAdmin && (
        <div className="bg-white rounded-lg shadow p-4 mt-6">
          <h2 className="font-semibold mb-4">User Permissions</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{u.name || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                    }`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => updateRole.mutate({ id: u.id, role: e.target.value })}
                      className="border rounded p-1 text-sm"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No users</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
