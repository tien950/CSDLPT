import { useEffect, useState, useMemo } from 'react';
import Pagination from '../../components/Pagination';

const campusOptions = [
  { value: 'HQHD', label: 'Hà Đông' },
  { value: 'HQHL', label: 'Hòa Lạc' },
  { value: 'HQHCM', label: 'TP. HCM' }
];

function formatMessage(payload) {
  if (!payload) return '';
  if (payload.node && payload.status === 'offline') {
    return `Node ${payload.node} đang offline.`;
  }
  return payload.message ?? 'Có lỗi xảy ra.';
}

export default function DanhSachLopHoc({ apiBase, token, user }) {
  const [maCS, setMaCS] = useState(user.maCS);
  const [page, setPage] = useState(1);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, pages: 0 });
  const [cache, setCache] = useState({});

  const campusLabel = useMemo(() => {
    const option = campusOptions.find(item => item.value === user.maCS);
    return option ? option.label : user.maCS;
  }, [user.maCS]);

  const cacheKey = `${maCS}_${page}`;

  useEffect(() => {
    if (cache[cacheKey]) {
      setClasses(cache[cacheKey].data);
      setPagination(cache[cacheKey].pagination);
      return;
    }

    let isActive = true;
    const fetchClasses = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(
          `${apiBase}/api/hocphan/available?maCS=${maCS}&page=${page}&pageSize=20`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw payload;
        }

        if (isActive) {
          const data = payload.data ?? [];
          setClasses(data);
          setPagination(payload.pagination);

          // Cache result
          setCache(prev => ({
            ...prev,
            [cacheKey]: {
              data,
              pagination: payload.pagination
            }
          }));
        }
      } catch (err) {
        if (isActive) {
          setError(formatMessage(err));
          setClasses([]);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    fetchClasses();
    return () => {
      isActive = false;
    };
  }, [apiBase, token, maCS, page, cacheKey, cache]);

  const onPageChange = (newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="card">
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ marginRight: '1rem' }}>
          Cơ sở:
          <select
            value={maCS}
            onChange={e => {
              setMaCS(e.target.value);
              setPage(1);
            }}
            style={{ marginLeft: '8px', padding: '8px' }}
          >
            {campusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <span style={{ color: '#666' }}>
          Cơ sở của bạn: <strong>{campusLabel}</strong>
        </span>
      </div>

      <h2>Danh Sách Lớp Học Có Sẵn</h2>

      {error && <div className="alert">{error}</div>}

      {!loading && classes.length === 0 && !error && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
          <p>Không có lớp học phần tại cơ sở này.</p>
        </div>
      )}

      {loading && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
          <p>Đang tải...</p>
        </div>
      )}

      {classes.length > 0 && (
        <div>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            Tổng: <strong>{pagination.total}</strong> lớp | Trang{' '}
            <strong>
              {pagination.page} / {pagination.pages}
            </strong>
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: '800px'
            }}>
              <thead>
                <tr style={{
                  backgroundColor: '#1976d2',
                  color: 'white',
                  borderBottom: '2px solid #1976d2'
                }}>
                  <th style={{ padding: '12px 8px', textAlign: 'left', width: '12%' }}>Mã Lớp</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', width: '18%' }}>Môn Học</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', width: '12%' }}>Số TC</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', width: '14%' }}>Giảng Viên</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', width: '10%' }}>Sĩ số</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', width: '12%' }}>Còn Lại</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', width: '12%' }}>Học Kỳ</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((cls, idx) => (
                  <tr
                    key={`${cls.maMH}-${idx}`}
                    style={{
                      borderBottom: '1px solid #eee',
                      backgroundColor: idx % 2 === 0 ? '#f9f9f9' : 'white'
                    }}
                  >
                    <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>
                      <span style={{ color: '#1976d2' }}>{cls.maMH}</span>
                    </td>
                    <td style={{ padding: '12px 8px' }}>{cls.tenMonHoc}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>{cls.soTC}</td>
                    <td style={{ padding: '12px 8px' }}>{cls.giangVien}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>{cls.siSoToiDa}</td>
                    <td style={{
                      padding: '12px 8px',
                      textAlign: 'center',
                      color: cls.conLai < 5 ? '#d32f2f' : '#388e3c',
                      fontWeight: 'bold'
                    }}>
                      {cls.conLai}
                    </td>
                    <td style={{ padding: '12px 8px' }}>{cls.hocKy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={pagination.page}
            pages={pagination.pages}
            onPageChange={onPageChange}
            loading={loading}
          />
        </div>
      )}
    </section>
  );
}

