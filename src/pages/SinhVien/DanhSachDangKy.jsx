import { useEffect, useState } from 'react';

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

function getStatusColor(status) {
  switch (status) {
    case 'REGISTERED':
      return 'success';
    case 'CANCELLED':
      return 'error';
    default:
      return '';
  }
}

function getStatusLabel(status) {
  switch (status) {
    case 'REGISTERED':
      return 'Đã đăng ký';
    case 'CANCELLED':
      return 'Đã hủy';
    default:
      return status;
  }
}

export default function DanhSachDangKy({ apiBase, token }) {
  const [available, setAvailable] = useState([]);
  const [registered, setRegistered] = useState([]);
  const [loading, setLoading] = useState(false);
  const [schedules, setSchedules] = useState({});
  const [expandedClass, setExpandedClass] = useState(null);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(null);
  const [registering, setRegistering] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  const nodes = ['HQHD', 'HQHL', 'HQHCM'];
  const nodeNames = { HQHD: 'Hà Đông', HQHL: 'Hòa Lạc', HQHCM: 'TP. Hồ Chí Minh' };

  useEffect(() => {
    const userNode = localStorage.getItem('userNode') || 'HQHD';
    setSelectedNode(userNode);
    fetchData(userNode);
  }, []);

  const handleNodeChange = (e) => {
    const newNode = e.target.value;
    setSelectedNode(newNode);
    localStorage.setItem('userNode', newNode);
    fetchData(newNode);
  };

  const fetchData = async (nodeKey) => {
    const maCS = nodeKey || selectedNode;
    setLoading(true);
    setError('');
    try {
      const [availRes, regRes] = await Promise.all([
        fetch(`${apiBase}/api/hocphan/available?maCS=${maCS}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBase}/api/sinhvien/registrations`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const availData = await availRes.json();
      const regData = await regRes.json();

      if (!availData.success) {
        setError(availData.message || 'Không thể tải danh sách môn học.');
        setAvailable([]);
      } else {
        setAvailable(availData.data || []);
      }

      if (!regData.success) {
        setError(prev => prev ? prev + ' | ' + (regData.message || 'Lỗi tải danh sách đã đăng ký') : (regData.message || 'Lỗi tải danh sách đã đăng ký'));
      } else {
        setRegistered(regData.data || []);
      }
    } catch (err) {
      setError('Có lỗi khi tải dữ liệu: ' + err.message);
      setAvailable([]);
      setRegistered([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedule = async (classId) => {
    if (schedules[classId]) {
      setExpandedClass(expandedClass === classId ? null : classId);
      return;
    }

    try {
      const res = await fetch(`${apiBase}/api/hocphan/schedule/${classId}?maCS=${selectedNode}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setSchedules(prev => ({
        ...prev,
        [classId]: data.success ? data.data : []
      }));
      setExpandedClass(classId);
    } catch (err) {
      setSchedules(prev => ({
        ...prev,
        [classId]: []
      }));
    }
  };

  const handleCancel = async (maDangKy) => {
    if (!window.confirm('Bạn có chắc muốn hủy đăng ký môn học này?')) return;

    setCancelling(maDangKy);
    try {
      const res = await fetch(`${apiBase}/api/dangky/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ maDangKy })
      });
      const data = await res.json();

      if (data.success) {
        alert('Hủy đăng ký thành công!');
        fetchData();
      } else {
        alert(data.message || 'Hủy đăng ký thất bại.');
      }
    } catch (err) {
      alert('Có lỗi khi hủy đăng ký.');
    } finally {
      setCancelling(null);
    }
  };

  const handleRegister = async (maMH) => {
    setRegistering(maMH);
    try {
      const res = await fetch(`${apiBase}/api/dangky`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          maLop: maMH,
          maCSLop: selectedNode
        })
      });
      const data = await res.json();

      if (data.success) {
        alert('Đăng ký thành công!');
        fetchData();
      } else {
        alert(data.message || 'Đăng ký thất bại.');
      }
    } catch (err) {
      alert('Có lỗi khi đăng ký.');
    } finally {
      setRegistering(null);
    }
  };

  return (
    <section className="card">
      <h2>Quản Lý Đăng Ký Học Phần</h2>
      {error && <div className="alert">{error}</div>}

      <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <label htmlFor="nodeSelect" style={{ fontWeight: 'bold' }}>Chọn Cơ Sở:</label>
        <select
          id="nodeSelect"
          value={selectedNode}
          onChange={handleNodeChange}
          style={{
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid #ddd',
            fontSize: '1rem',
            cursor: 'pointer'
          }}
        >
          {nodes.map(node => (
            <option key={node} value={node}>{nodeNames[node]}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ color: '#d32f2f', borderBottom: '3px solid #d32f2f', paddingBottom: '8px' }}>
          Danh Sách Môn Học Mở Cho Đăng Ký ({nodeNames[selectedNode]})
        </h3>
        {loading ? (
          <p>Đang tải...</p>
        ) : available.length === 0 ? (
          <p style={{ color: '#999' }}>Không có môn học mở đăng ký.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #d32f2f' }}>
                <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>Mã MH</th>
                <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>Tên Môn Học</th>
                <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Nhóm</th>
                <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>Giảng Viên</th>
                <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Số TC</th>
                <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Số Lượng</th>
                <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Còn Lại</th>
                <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Thời Khóa Biểu</th>
                <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Đăng Ký</th>
              </tr>
            </thead>
            <tbody>
              {available.map((cls, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px' }}>{cls.maMH}</td>
                  <td style={{ padding: '8px' }}>{cls.tenMonHoc}</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>{cls.nhom}</td>
                  <td style={{ padding: '8px' }}>{cls.giangVien}</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>{cls.soTC}</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>{cls.siSoDaDangKy}</td>
                  <td style={{ padding: '8px', textAlign: 'center', color: cls.conLai <= 3 ? '#d32f2f' : '#388e3c' }}>
                    <strong>{cls.conLai}</strong>
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <button
                      onClick={() => fetchSchedule(cls.maMH)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: expandedClass === cls.maMH ? '#1976d2' : '#f5f5f5',
                        color: expandedClass === cls.maMH ? 'white' : '#333',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      {expandedClass === cls.maMH ? '▼' : '▶'}
                    </button>
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleRegister(cls.maMH)}
                      disabled={registering === cls.maMH || cls.conLai <= 0}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: cls.conLai <= 0 ? '#ccc' : '#388e3c',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: cls.conLai <= 0 ? 'not-allowed' : (registering === cls.maMH ? 'wait' : 'pointer'),
                        fontWeight: 'bold'
                      }}
                    >
                      {registering === cls.maMH ? '...' : cls.conLai <= 0 ? 'Hết' : 'Đăng Ký'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {expandedClass && schedules[expandedClass] && (
          <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
            <h4>Lịch Học - {expandedClass}</h4>
            {schedules[expandedClass].length === 0 ? (
              <p>Không có lịch học.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#e0e0e0' }}>
                    <th style={{ padding: '6px', textAlign: 'left' }}>Ngày Học</th>
                    <th style={{ padding: '6px', textAlign: 'left' }}>Thứ</th>
                    <th style={{ padding: '6px', textAlign: 'left' }}>Ca Học</th>
                    <th style={{ padding: '6px', textAlign: 'left' }}>Giờ</th>
                    <th style={{ padding: '6px', textAlign: 'left' }}>Phòng Học</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules[expandedClass].map((sess, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '6px' }}>{formatDate(sess.ngayHoc)}</td>
                      <td style={{ padding: '6px' }}>Thứ {sess.thuHoc}</td>
                      <td style={{ padding: '6px' }}>Ca {sess.caHoc}</td>
                      <td style={{ padding: '6px' }}>{sess.gioStart} - {sess.gioEnd}</td>
                      <td style={{ padding: '6px' }}>{sess.phongHoc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <div>
        <h3 style={{ color: '#1976d2', borderBottom: '3px solid #1976d2', paddingBottom: '8px' }}>
          Danh Sách Môn Học Đã Đăng Ký
        </h3>
        {registered.length === 0 ? (
          <p style={{ color: '#999' }}>Chưa đăng ký môn học nào.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #1976d2' }}>
                <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Xóa</th>
                <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>Mã MH</th>
                <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>Tên Môn Học</th>
                <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Nhóm</th>
                <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>Giảng Viên</th>
                <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Số TC</th>
                <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>Ngày Đăng Ký</th>
                <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Trạng Thái</th>
              </tr>
            </thead>
            <tbody>
              {registered.map((reg, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #eee', opacity: reg.trangThai === 'CANCELLED' ? 0.6 : 1 }}>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    {reg.trangThai === 'REGISTERED' && (
                      <button
                        onClick={() => handleCancel(reg.maDangKy)}
                        disabled={cancelling === reg.maDangKy}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#d32f2f',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: cancelling === reg.maDangKy ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {cancelling === reg.maDangKy ? '...' : '×'}
                      </button>
                    )}
                  </td>
                  <td style={{ padding: '8px' }}>{reg.maMH}</td>
                  <td style={{ padding: '8px' }}>{reg.tenMonHoc}</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>{reg.nhom}</td>
                  <td style={{ padding: '8px' }}>{reg.giangVien}</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>{reg.soTC}</td>
                  <td style={{ padding: '8px' }}>{formatDate(reg.ngayDangKy)}</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <span className={`status-${getStatusColor(reg.trangThai)}`} style={{ fontWeight: 'bold' }}>
                      {getStatusLabel(reg.trangThai)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
