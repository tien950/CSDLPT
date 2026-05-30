import { useCallback, useEffect, useMemo, useState } from 'react';

const statusLabels = {
  online: 'Online',
  offline: 'Offline',
  error: 'Lỗi'
};

export default function NodeStatusBar({ apiBase, token, autoRefreshMs = 10000 }) {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${apiBase}/api/nodes/status`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? 'Không thể tải trạng thái node.');
      }
      setNodes(payload.data ?? []);
      setLastUpdated(new Date());
    } catch (error) {
      setMessage(error.message ?? 'Có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  }, [apiBase, token]);

  const summary = useMemo(() => {
    return nodes.reduce(
      (acc, node) => {
        acc.total += 1;
        if (node.status === 'online') acc.online += 1;
        if (node.status === 'offline') acc.offline += 1;
        if (node.status === 'error') acc.error += 1;
        return acc;
      },
      { total: 0, online: 0, offline: 0, error: 0 }
    );
  }, [nodes]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!autoRefresh || !autoRefreshMs) return undefined;
    const timer = setInterval(fetchStatus, autoRefreshMs);
    return () => clearInterval(timer);
  }, [autoRefresh, autoRefreshMs, fetchStatus]);

  const lastUpdatedText = lastUpdated
    ? new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(lastUpdated)
    : 'Chưa có dữ liệu';

  return (
    <section className="card">
      <div className="row">
        <div>
          <h2>Giám sát node</h2>
          <p className="subtitle">Cập nhật lần cuối: {lastUpdatedText}</p>
        </div>
        <div className="actions">
          <label className="toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={event => setAutoRefresh(event.target.checked)}
            />
            Tự động
          </label>
          <button
            type="button"
            className="secondary"
            onClick={fetchStatus}
            disabled={loading}
          >
            {loading ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>
      </div>

      <div className="status-row">
        <span className="status-chip online">Online: {summary.online}</span>
        <span className="status-chip offline">Offline: {summary.offline}</span>
        <span className="status-chip error">Lỗi: {summary.error}</span>
        <span className="status-chip">Tổng: {summary.total}</span>
      </div>

      {message && <div className="alert">{message}</div>}

      <div className="table-wrap">
        <table className="node-table">
          <thead>
            <tr>
              <th>Node</th>
              <th>Trạng thái</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map(node => (
              <tr key={node.node}>
                <td>{node.node}</td>
                <td>
                  <span className={`status-pill ${node.status}`}>
                    {statusLabels[node.status] ?? 'Không xác định'}
                  </span>
                </td>
                <td>{node.message ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nodes.length === 0 && !message && <p>Chưa có dữ liệu node.</p>}
    </section>
  );
}
