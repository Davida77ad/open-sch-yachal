import { useCallback, useEffect, useState } from 'react';

const API_BASE = import.meta.env.PROD ? '' : import.meta.env.VITE_API_BASE || 'http://localhost:4001';
const ADMIN_TOKEN_KEY = 'open-school-admin-token';
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function requestApi(path, options = {}, onRetry = () => {}) {
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        signal: controller.signal,
      });
      window.clearTimeout(timeout);

      if (RETRYABLE_STATUSES.has(response.status) && attempt === 0) {
        onRetry();
        await wait(2000);
        continue;
      }
      return response;
    } catch (error) {
      window.clearTimeout(timeout);
      lastError = error;
      if (attempt === 0) {
        onRetry();
        await wait(2000);
        continue;
      }
    }
  }

  throw lastError || new Error('Unable to reach the server.');
}

async function readJsonResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error('The server returned an invalid response. Please refresh and try again.');
  }
}

function formatStatus(status) {
  if (status === 'awaiting-momo-payment') return 'Awaiting momo payment';
  if (status === 'momo-review-pending') return 'Momo awaiting admin review';
  if (status === 'momo-paid') return 'Momo paid';
  if (status === 'cash-pending') return 'Cash pending';
  if (status === 'cash-paid') return 'Cash paid';
  return status;
}

export default function AdminDashboard() {
  const [token, setToken] = useState(() => window.sessionStorage.getItem(ADMIN_TOKEN_KEY) || '');
  const [registrations, setRegistrations] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [storage, setStorage] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);
  const [confirmingId, setConfirmingId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editForm, setEditForm] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [capabilities, setCapabilities] = useState({});

  const loadRegistrations = useCallback(async ({ silent = false } = {}) => {
    const adminToken = token.trim();
    if (!adminToken) {
      setError('Enter your admin token to load registrations.');
      return;
    }

    if (!silent) setLoading(true);
    setError('');
    if (!silent) {
      setMessage('');
      setLoadingStatus('Connecting to the registration database...');
    }

    const wakingTimer = window.setTimeout(() => {
      if (!silent) setLoadingStatus('The server is waking up. This can take up to a minute...');
    }, 5000);

    try {
      const response = await requestApi('/api/admin/registrations', {
        headers: { 'x-admin-token': adminToken },
      }, () => {
        if (!silent) setLoadingStatus('Retrying the server connection...');
      });
      const data = await readJsonResponse(response);

      if (!response.ok) {
        setError(data.message || 'Unable to load registrations.');
        return;
      }

      const loadedRegistrations = Array.isArray(data.registrations) ? data.registrations : [];
      setRegistrations(loadedRegistrations);
      setStorage(data.storage || '');
      setCapabilities(data.capabilities || {});
      setHasLoaded(true);
      window.sessionStorage.setItem(ADMIN_TOKEN_KEY, adminToken);
      const storageLabel = data.storage === 'file' ? 'local file storage' : data.storage === 'mongo' ? 'MongoDB' : 'storage';
      const databaseLabel = data.database ? ` (${data.database})` : '';
      setMessage(`Showing ${loadedRegistrations.length} registrations from ${storageLabel}${databaseLabel}.`);
    } catch (loadError) {
      setError(loadError.name === 'AbortError'
        ? 'The registration server took too long to respond. Please press Refresh registrations.'
        : loadError.message || 'Unable to reach the server.');
      console.error(loadError);
    } finally {
      window.clearTimeout(wakingTimer);
      if (!silent) {
        setLoading(false);
        setLoadingStatus('');
      }
    }
  }, [token]);

  useEffect(() => {
    if (!hasLoaded) return undefined;
    const interval = window.setInterval(() => {
      loadRegistrations({ silent: true });
    }, 60000);
    return () => window.clearInterval(interval);
  }, [hasLoaded, loadRegistrations]);

  const confirmPayment = async (registration) => {
    setConfirmingId(registration._id);
    setError('');
    setMessage('');

    try {
      const response = await requestApi(`/api/admin/registrations/${registration._id}/confirm-payment`, {
        method: 'POST',
        headers: { 'x-admin-token': token.trim() },
      });
      const data = await readJsonResponse(response);

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

  const startEdit = (registration) => {
    setEditingId(registration._id);
    setEditForm({
      fullName: registration.fullName,
      email: registration.email,
      phone: registration.phone,
      country: registration.country || 'Ghana',
      church: registration.church || '',
      churchRole: registration.churchRole || 'Member',
    });
    setError('');
    setMessage('');
  };

  const cancelEdit = () => {
    setEditingId('');
    setEditForm(null);
  };

  const updateEditField = (field, value) => {
    setEditForm((current) => ({ ...current, [field]: value }));
  };

  const saveEdit = async () => {
    if (!editingId || !editForm) return;

    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await requestApi(`/api/admin/registrations/${editingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token.trim(),
        },
        body: JSON.stringify(editForm),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setError(data.message || 'Unable to update registration.');
        return;
      }

      setRegistrations((current) => current.map((item) => (
        item._id === data.registration._id ? data.registration : item
      )));
      setMessage(`${data.registration.fullName}'s registration was updated.`);
      cancelEdit();
    } catch (updateError) {
      setError('Unable to reach the server.');
      console.error(updateError);
    } finally {
      setLoading(false);
    }
  };

  const deleteRegistration = async (registration) => {
    const shouldDelete = window.confirm(
      `Delete ${registration.fullName}'s registration? This cannot be undone.`
    );
    if (!shouldDelete) return;

    setDeletingId(registration._id);
    setError('');
    setMessage('');
    try {
      const response = await requestApi(`/api/admin/registrations/${registration._id}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': token.trim() },
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        setError(data.message || 'Unable to delete registration.');
        return;
      }

      setRegistrations((current) => current.filter((item) => item._id !== registration._id));
      if (editingId === registration._id) cancelEdit();
      setMessage(`${registration.fullName}'s registration was deleted.`);
    } catch (deleteError) {
      setError('Unable to reach the server.');
      console.error(deleteError);
    } finally {
      setDeletingId('');
    }
  };

  const exportCsv = async () => {
    if (!token) {
      setError('Enter your admin token before exporting.');
      return;
    }

    try {
      const response = await requestApi('/api/admin/export', {
        headers: { 'x-admin-token': token.trim() },
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
      {loadingStatus && <div className="note" role="status">{loadingStatus}</div>}
      {storage === 'file' && (
        <div className="storage-warning">
          Local development is using <strong>registrations.local.json</strong>. These records will not appear in MongoDB Compass or the production admin dashboard.
        </div>
      )}

      <form className="form-grid two-col" onSubmit={(event) => { event.preventDefault(); loadRegistrations(); }}>
        <div>
          <label htmlFor="adminToken">Admin Token</label>
          <input id="adminToken" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Enter admin token" />
        </div>
      </form>

      <div className="actions">
        <button className="action-button" type="button" onClick={loadRegistrations} disabled={loading || !token}>
          {loading ? 'Loading...' : hasLoaded ? 'Refresh registrations' : 'Load registrations'}
        </button>
        <button className="secondary-button" type="button" onClick={exportCsv} disabled={!token}>
          Download CSV
        </button>
      </div>

      {hasLoaded && (
        <div className="registration-count" role="status">
          <strong>{registrations.length}</strong> registration{registrations.length === 1 ? '' : 's'} available
        </div>
      )}

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
                <td>
                  {editingId === item._id ? (
                    <input value={editForm.fullName} onChange={(event) => updateEditField('fullName', event.target.value)} />
                  ) : item.fullName}
                </td>
                <td>
                  {editingId === item._id ? (
                    <input type="email" value={editForm.email} onChange={(event) => updateEditField('email', event.target.value)} />
                  ) : item.email}
                </td>
                <td>
                  {editingId === item._id ? (
                    <input value={editForm.phone} onChange={(event) => updateEditField('phone', event.target.value)} />
                  ) : item.phone}
                </td>
                <td>
                  {editingId === item._id ? (
                    <input value={editForm.church} onChange={(event) => updateEditField('church', event.target.value)} />
                  ) : (item.church || '-')}
                </td>
                <td>
                  {editingId === item._id ? (
                    <select value={editForm.churchRole} onChange={(event) => updateEditField('churchRole', event.target.value)}>
                      <option value="Pastor">Pastor</option>
                      <option value="Church worker">Church worker</option>
                      <option value="Leader">Leader</option>
                      <option value="Member">Member</option>
                      <option value="Other">Other</option>
                    </select>
                  ) : (item.churchRole || '-')}
                </td>
                <td>{item.paymentMethod}</td>
                <td>
                  <span className={`status-pill ${item.status.includes('paid') ? 'status-paid' : 'status-awaiting'}`}>
                    {formatStatus(item.status)}
                  </span>
                </td>
                <td>{item.momoReference || '-'}</td>
                <td>{item.momoTransactionId || '-'}</td>
                <td>
                  <div className="table-actions">
                    {capabilities.updateRegistration && editingId === item._id ? (
                      <>
                        <button className="action-button" type="button" onClick={saveEdit} disabled={loading}>Save</button>
                        <button className="secondary-button" type="button" onClick={cancelEdit} disabled={loading}>Cancel</button>
                      </>
                    ) : capabilities.updateRegistration ? (
                      <button className="secondary-button" type="button" onClick={() => startEdit(item)}>Edit</button>
                    ) : null}
                    {capabilities.confirmPayment && (item.status === 'momo-review-pending' || item.status === 'cash-pending') && editingId !== item._id && (
                      <button
                        className="action-button"
                        type="button"
                        onClick={() => confirmPayment(item)}
                        disabled={confirmingId === item._id}
                      >
                        {confirmingId === item._id ? 'Confirming...' : 'Confirm payment'}
                      </button>
                    )}
                    {capabilities.deleteRegistration && editingId !== item._id && (
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => deleteRegistration(item)}
                        disabled={deletingId === item._id}
                      >
                        {deletingId === item._id ? 'Deleting...' : 'Delete'}
                      </button>
                    )}
                    {!capabilities.updateRegistration && !capabilities.confirmPayment && !capabilities.deleteRegistration && '-'}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
