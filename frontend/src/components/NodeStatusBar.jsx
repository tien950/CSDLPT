import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../config/api.js';
import Pagination from './Pagination.jsx';

const statusLabels = {
  online: 'Online',
  offline: 'Offline',
  error: 'Loi',
};

const PAGE_SIZE = 10;

export default function NodeStatusBar({ maCS, autoRefreshMs = 5000 }) {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [page, setPage] = useState(1);

  const selectedCampus = maCS ?? localStorage.getItem('userNode') ?? 'HQHD';

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const payload = await apiFetch('/api/admin/node-status', selectedCampus);
      const nodesPayload = payload?.nodes ?? {};
      const rows = Object.entries(nodesPayload).map(([campus, info]) => ({
        campus,
        status: info.status ?? 'offline',
        timestamp: info.timestamp ?? null,
      }));
      setNodes(rows);
      setLastUpdated(new Date());
      setPage(1);
    } catch (error) {
      setMessage(error.message ?? 'Co loi xay ra.');
    } finally {
      setLoading(false);
    }
  }, [selectedCampus]);

  const summary = useMemo(
    () =>
      nodes.reduce(
        (acc, row) => {
          acc.total += 1;
          if (row.status === 'online') acc.online += 1;
          if (row.status === 'offline') acc.offline += 1;
          if (row.status === 'error') acc.error += 1;
          return acc;
        },
        { total: 0, online: 0, offline: 0, error: 0 }
      ),
    [nodes]
  );

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!autoRefresh || !autoRefreshMs) return undefined;
    const timer = setInterval(fetchStatus, autoRefreshMs);
    return () => clearInterval(timer);
  }, [autoRefresh, autoRefreshMs, fetchStatus]);

  const lastUpdatedText = lastUpdated
    ? new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(lastUpdated)
    : 'Chua co du lieu';

  const pageCount = Math.max(1, Math.ceil(nodes.length / PAGE_SIZE));
  const pageRows = nodes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <section className="card">
      <div className="row">
        <div>
          <h2>Giam sat co so</h2>
          <p className="subtitle">Cap nhat lan cuoi: {lastUpdatedText}</p>
        </div>
        <div className="actions">
          <label className="toggle">
            <input type="checkbox" checked={autoRefresh} onChange={event => setAutoRefresh(event.target.checked)} />
            Tu dong
          </label>
          <button type="button" className="secondary" onClick={fetchStatus} disabled={loading}>
            {loading ? 'Dang tai...' : 'Lam moi'}
          </button>
        </div>
      </div>

      <div className="status-row">
        <span className="status-chip online">Online: {summary.online}</span>
        <span className="status-chip offline">Offline: {summary.offline}</span>
        <span className="status-chip error">Loi: {summary.error}</span>
        <span className="status-chip">Tong: {summary.total}</span>
      </div>

      {message && <div className="alert">{message}</div>}

      <div className="table-wrap">
        <table className="node-table">
          <thead>
            <tr>
              <th>Co so</th>
              <th>Trang thai</th>
              <th>Ghi chu</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(row => (
              <tr key={row.campus}>
                <td>{row.campus}</td>
                <td>
                  <span className={`status-pill ${row.status}`}>{statusLabels[row.status] ?? 'Khong xac dinh'}</span>
                </td>
                <td>{row.timestamp ?? '-'}</td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center' }}>
                  Chua co du lieu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pages={pageCount} onPageChange={setPage} loading={loading} />
    </section>
  );
}
