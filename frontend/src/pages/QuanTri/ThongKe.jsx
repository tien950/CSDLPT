import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../config/api.js';

const NODE_OPTIONS = [
  { key: 'HQHD', label: 'Hà Đông' },
  { key: 'HQHL', label: 'Hòa Lạc' },
  { key: 'HQHCM', label: 'TP. Hồ Chí Minh' }
];

export default function ThongKe({ user }) {
  const [nodeKey, setNodeKey] = useState(user?.maCS ?? 'HQHD');
  const [scope, setScope] = useState(user?.role === 'quantrivien' ? 'all' : 'node');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const canPickNode = user?.role === 'quantrivien';

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        params.set('scope', scope);
        if (scope === 'node') {
          params.set('maCS', nodeKey);
        }

        const baseCampus = scope === 'node' ? nodeKey : (user?.maCS ?? nodeKey);
        const data = await apiFetch(`/api/thongke/overview?${params.toString()}`, baseCampus);
        if (!data.success) {
          setError(data.message || 'Không thể tải thống kê.');
          setData(null);
        } else {
          setData(data.data);
        }
      } catch (err) {
        setError('Có lỗi khi tải thống kê: ' + err.message);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [nodeKey, scope, user?.maCS]);

  const rows = useMemo(() => {
    const perNode = data?.perNode ?? {};
    return Object.entries(perNode).map(([node, stats]) => ({
      node,
      ...stats
    }));
  }, [data]);

  const totals = data?.total ?? null;
  const offlineNodes = data?.offlineNodes ?? [];

  return (
    <div className="stack">
      <section className="card">
        <h2>Thống kê tổng quan</h2>
        <p className="subtitle">Theo dõi số liệu theo cơ sở hoặc toàn trường.</p>
        {error && <div className="alert" style={{ marginTop: '12px' }}>{error}</div>}

        <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          <label style={{ minWidth: '220px' }}>
            Phạm vi
            <select value={scope} onChange={event => setScope(event.target.value)}>
              {canPickNode && <option value="all">Toàn trường</option>}
              <option value="node">Theo cơ sở</option>
            </select>
          </label>

          {scope === 'node' && (
            <label style={{ minWidth: '220px' }}>
              Cơ sở
              <select value={nodeKey} onChange={event => setNodeKey(event.target.value)} disabled={!canPickNode}>
                {NODE_OPTIONS.map(option => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </section>

      <section className="card">
        <h3>Kết quả thống kê</h3>
        {loading ? (
          <p>Đang tải...</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cơ sở</th>
                  <th>Cơ sở đào tạo</th>
                  <th>Phòng ban</th>
                  <th>Sinh viên</th>
                  <th>Giảng viên</th>
                  <th>Học phần</th>
                  <th>Lớp học phần</th>
                  <th>Phòng học</th>
                  <th>Lịch học</th>
                  <th>Đăng ký</th>
                  <th>Hủy đăng ký</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.node}>
                    <td>{row.node}</td>
                    <td>{row.headquarter}</td>
                    <td>{row.department}</td>
                    <td>{row.student}</td>
                    <td>{row.teacher}</td>
                    <td>{row.subject}</td>
                    <td>{row.class}</td>
                    <td>{row.room}</td>
                    <td>{row.session}</td>
                    <td>{row.registration}</td>
                    <td>{row.cancelled}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', color: '#777' }}>Chưa có dữ liệu.</td>
                  </tr>
                )}
              </tbody>
              {totals && scope === 'all' && (
                <tfoot>
                  <tr style={{ fontWeight: 700, background: '#f7f8fb' }}>
                    <td>Tổng</td>
                    <td>{totals.headquarter}</td>
                    <td>{totals.department}</td>
                    <td>{totals.student}</td>
                    <td>{totals.teacher}</td>
                    <td>{totals.subject}</td>
                    <td>{totals.class}</td>
                    <td>{totals.room}</td>
                    <td>{totals.session}</td>
                    <td>{totals.registration}</td>
                    <td>{totals.cancelled}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {offlineNodes.length > 0 && (
          <p className="subtitle" style={{ marginTop: '12px' }}>
            Node offline: {offlineNodes.join(', ')}
          </p>
        )}
      </section>
    </div>
  );
}
