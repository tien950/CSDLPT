import { useEffect, useMemo, useState } from 'react';
import { apiFetch, gatewayFetch } from '../../config/api.js';
import Pagination from '../../components/Pagination.jsx';

const CAMPUS_OPTIONS = [
  { key: 'HQHD', label: 'Ha Dong' },
  { key: 'HQHL', label: 'Hoa Lac' },
  { key: 'HQHCM', label: 'TP. HCM' },
];

const DISTRIBUTED_QUERY_OPTIONS = [
  { key: 'q1', label: 'Q1 - So SV dang ky theo co so' },
  { key: 'q2', label: 'Q2 - Hoc phan dang ky nhieu nhat' },
  { key: 'q3', label: 'Q3 - Danh sach dang ky cheo co so' },
  { key: 'q4', label: 'Q4 - Ty le lap day lop hoc phan' },
  { key: 'q5', label: 'Q5 - So lop hoc phan mo theo khoa' },
  { key: 'q6', label: 'Q6 - Danh sach lop hoc phan con cho' },
  { key: 'q7', label: 'Q7 - Khoi luong giang day giang vien' },
];

const PAGE_SIZE = 10;

export default function ThongKe({ user }) {
  const [campus, setCampus] = useState(user?.maCS ?? 'HQHD');
  const [scope, setScope] = useState(user?.role === 'quantrivien' ? 'all' : 'campus');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState(null);

  const [distributedKey, setDistributedKey] = useState('q1');
  const [distributedRows, setDistributedRows] = useState([]);
  const [distributedTitle, setDistributedTitle] = useState('');
  const [distributedLoading, setDistributedLoading] = useState(false);
  const [distributedError, setDistributedError] = useState('');

  const [pageOverview, setPageOverview] = useState(1);
  const [pageDistributed, setPageDistributed] = useState(1);

  const isCentralAdmin = user?.role === 'quantrivien' && user?.maCS === 'HQHD';
  const canPickCampus = user?.role === 'quantrivien';

  useEffect(() => {
    const fetchOverview = async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        params.set('scope', scope);
        if (scope === 'campus') params.set('maCS', campus);
        const baseCampus = scope === 'campus' ? campus : (user?.maCS ?? campus);
        const data = await apiFetch(`/api/thongke/overview?${params.toString()}`, baseCampus);
        if (!data.success) {
          setOverview(null);
          setError(data.message || 'Khong the tai thong ke.');
          return;
        }
        setOverview(data.data);
        setPageOverview(1);
      } catch (err) {
        setOverview(null);
        setError('Loi tai thong ke: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchOverview();
  }, [scope, campus, user?.maCS]);

  const overviewRows = useMemo(
    () => Object.entries(overview?.perNode ?? {}).map(([coSo, stats]) => ({ coSo, ...stats })),
    [overview]
  );

  const overviewPageCount = Math.max(1, Math.ceil(overviewRows.length / PAGE_SIZE));
  const overviewPageRows = useMemo(
    () => overviewRows.slice((pageOverview - 1) * PAGE_SIZE, pageOverview * PAGE_SIZE),
    [overviewRows, pageOverview]
  );

  const offlineNodes = overview?.offlineNodes ?? [];

  const runDistributedQuery = async () => {
    setDistributedLoading(true);
    setDistributedError('');
    try {
      const data = await gatewayFetch(`/api/thongke/distributed/${distributedKey}`);
      if (!data.success) {
        setDistributedRows([]);
        setDistributedTitle('');
        setDistributedError(data.message || 'Khong chay duoc truy van.');
        return;
      }
      setDistributedRows(data.data ?? []);
      setDistributedTitle(data.meta?.title ?? '');
      setPageDistributed(1);
    } catch (err) {
      setDistributedRows([]);
      setDistributedTitle('');
      setDistributedError(err.message || 'Khong chay duoc truy van.');
    } finally {
      setDistributedLoading(false);
    }
  };

  const distributedColumns = useMemo(
    () => (distributedRows[0] ? Object.keys(distributedRows[0]) : []),
    [distributedRows]
  );
  const distributedPageCount = Math.max(1, Math.ceil(distributedRows.length / PAGE_SIZE));
  const distributedPageRows = useMemo(
    () => distributedRows.slice((pageDistributed - 1) * PAGE_SIZE, pageDistributed * PAGE_SIZE),
    [distributedRows, pageDistributed]
  );

  return (
    <div className="stack">
      <section className="card">
        <h2>Thong ke tong quan</h2>
        <p className="subtitle">Theo doi du lieu theo co so hoac toan truong.</p>
        {error && <div className="alert" style={{ marginTop: 12 }}>{error}</div>}

        <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <label style={{ minWidth: 220 }}>
            Pham vi
            <select value={scope} onChange={e => setScope(e.target.value)}>
              {canPickCampus && <option value="all">Toan truong</option>}
              <option value="campus">Theo co so</option>
            </select>
          </label>
          {scope === 'campus' && (
            <label style={{ minWidth: 220 }}>
              Co so
              <select value={campus} onChange={e => setCampus(e.target.value)} disabled={!canPickCampus}>
                {CAMPUS_OPTIONS.map(option => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </section>

      <section className="card">
        <h3>Ket qua thong ke</h3>
        {loading ? (
          <p>Dang tai...</p>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Co so</th>
                    <th>Co so dao tao</th>
                    <th>Khoa</th>
                    <th>Sinh vien</th>
                    <th>Giang vien</th>
                    <th>Hoc phan</th>
                    <th>Lop hoc phan</th>
                    <th>Phong hoc</th>
                    <th>Lich hoc</th>
                    <th>Dang ky</th>
                    <th>Huy dang ky</th>
                  </tr>
                </thead>
                <tbody>
                  {overviewPageRows.map(row => (
                    <tr key={row.coSo}>
                      <td>{row.coSo}</td>
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
                  {overviewPageRows.length === 0 && (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', color: '#777' }}>Chua co du lieu.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={pageOverview} pages={overviewPageCount} onPageChange={setPageOverview} loading={loading} />
          </>
        )}

        {offlineNodes.length > 0 && (
          <p className="subtitle" style={{ marginTop: 12 }}>
            Co so offline: {offlineNodes.join(', ')}
          </p>
        )}
      </section>

      {isCentralAdmin && (
        <section className="card">
          <h3>Truy van phan tan</h3>
          <p className="subtitle">Chay nhanh 7 truy van phan tan theo de tai.</p>
          {distributedError && <div className="alert" style={{ marginTop: 12 }}>{distributedError}</div>}

          <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
            <label style={{ minWidth: 340 }}>
              Chon truy van
              <select value={distributedKey} onChange={e => setDistributedKey(e.target.value)}>
                {DISTRIBUTED_QUERY_OPTIONS.map(item => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={runDistributedQuery} disabled={distributedLoading}>
              {distributedLoading ? 'Dang chay...' : 'Chay truy van'}
            </button>
          </div>

          {distributedTitle && (
            <p className="subtitle" style={{ marginTop: 12 }}>
              {distributedTitle} - Tong dong: {distributedRows.length}
            </p>
          )}

          {distributedRows.length > 0 && (
            <>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {distributedColumns.map(col => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {distributedPageRows.map((row, index) => (
                      <tr key={index}>
                        {distributedColumns.map(col => (
                          <td key={col}>{row[col] === null || row[col] === undefined ? '' : String(row[col])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={pageDistributed}
                pages={distributedPageCount}
                onPageChange={setPageDistributed}
                loading={distributedLoading}
              />
            </>
          )}
        </section>
      )}
    </div>
  );
}
