import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? 'https://open-sch-yachal.onrender.com' : 'http://localhost:4001');

function formatStatus(status) {
  if (status === 'awaiting-momo-payment') return 'Awaiting momo payment';
  if (status === 'momo-review-pending') return 'Momo awaiting admin review';
  if (status === 'momo-paid') return 'Momo paid';
  if (status === 'cash-pending') return 'Cash pending';
  if (status === 'cash-paid') return 'Cash paid';
  return status;
}

export default function AdminDashboard() {
  const [token, setToken] = useState('');
  const [registrations, setRegistrations] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [storage, setStorage] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);
  const [confirmingId, setConfirmingId] = useState('');

  const loadRegistrations = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    setHasLoaded(false);

    try {
      const response = await fetch(`${API_BASE}/api/admin/registrations`, {
        headers: { 'x-admin-token': token },
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Unable to load registrations.');
        return;
      }

      setRegistrations(data.registrations || []);
      setStorage(data.storage || '');
      setHasLoaded(true);
      const storageLabel = data.storage === 'file' ? 'local file storage' : data.storage === 'mongo' ? 'MongoDB' : 'storage';
      const databaseLabel = data.database ? ` (${data.database})` : '';
      setMessage(`Loaded ${data.registrations.length} registrations from ${storageLabel}${databaseLabel}.`);
    } catch (loadError) {
      setError('Unable to reach the server.');
      console.error(loadError);
    } finally {
      setLoading(false);
    }
  };

  const confirmPayment = async (registration) => {
    setConfirmingId(registration._id);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${API_BASE}/api/admin/registrations/${registration._id}/confirm-payment`, {
        method: 'POST',
        headers: { 'x-admin-token': token },
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Unable to confirm payment.');
        return;
      }

      setRegistrations((current) => current.map((item) => (
        item._id === data.registration._id ? data.registration : item
      )));
      if (data.email?.sent) {
        setMessage(`${data.registration.fullName}'s payment is confirmed and their slot confirmation email was sent.`);
      } else {
        setError(`${data.registration.fullName}'s payment is confirmed, but the email was not sent. Please contact them directly.`);
      }
    } catch (confirmError) {
      setError('Unable to reach the server.');
      console.error(confirmError);
    } finally {
      setConfirmingId('');
    }
  };

  const exportCsv = async () => {
    if (!token) {
      setError('Enter your admin token before exporting.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/admin/export`, {
        headers: { 'x-admin-token': token },
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.message || 'Unable to export CSV.');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'registrations.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (exportError) {
      setError('Unable to download CSV.');
      console.error(exportError);
    }
  };

  return (
    <div className="panel">
      <h2>Admin dashboard</h2>
      <p>Use your admin token to load registrations and download the CSV export.</p>

      {error && <div className="alert">{error}</div>}
      {message && <div className="note">{message}</div>}
      {storage === 'file' && (
        <div className="storage-warning">
          Local development is using <strong>registrations.local.json</strong>. These records will not appear in MongoDB Compass or the production admin dashboard.
        </div>
      )}

      <div className="form-grid two-col">
        <div>
          <label htmlFor="adminToken">Admin Token</label>
          <input id="adminToken" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Enter admin token" />
        </div>
      </div>

      <div className="actions">
        <button className="action-button" type="button" onClick={loadRegistrations} disabled={loading || !token}>
          {loading ? 'Loading...' : 'Load registrations'}
        </button>
        <button className="secondary-button" type="button" onClick={exportCsv} disabled={!token}>
          Download CSV
        </button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Church</th>
              <th>Role</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Reference</th>
              <th>Transaction</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {hasLoaded && !loading && registrations.length === 0 && (
              <tr>
                <td className="empty-table" colSpan="10">No registrations loaded from this data source.</td>
              </tr>
            )}
            {registrations.map((item) => (
              <tr key={item._id}>
                <td>{item.fullName}</td>
                <td>{item.email}</td>
                <td>{item.phone}</td>
                <td>{item.church || '-'}</td>
                <td>{item.churchRole || '-'}</td>
                <td>{item.paymentMethod}</td>
                <td>
                  <span className={`status-pill ${item.status.includes('paid') ? 'status-paid' : 'status-awaiting'}`}>
                    {formatStatus(item.status)}
                  </span>
                </td>
                <td>{item.momoReference || '-'}</td>
                <td>{item.momoTransactionId || '-'}</td>
                <td>
                  {(item.status === 'momo-review-pending' || item.status === 'cash-pending') ? (
                    <button
                      className="action-button"
                      type="button"
                      onClick={() => confirmPayment(item)}
                      disabled={confirmingId === item._id}
                    >
                      {confirmingId === item._id ? 'Confirming...' : 'Confirm payment'}
                    </button>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
