import { useEffect, useState } from 'react';
import Login from './pages/Login.jsx';
import DanhSachDangKy from './pages/SinhVien/DanhSachDangKy.jsx';
import XemThoiKhoaBieu from './pages/SinhVien/XemThoiKhoaBieu.jsx';
import GiamSatNode from './pages/QuanTri/GiamSatNode.jsx';
import QuanLyDuLieu from './pages/QuanTri/QuanLyDuLieu.jsx';
import ThongKe from './pages/QuanTri/ThongKe.jsx';

const STORAGE_KEY = 'csdlpt.auth';

const campusLabels = {
  HQHD: 'Hà Đông',
  HQHL: 'Hòa Lạc',
  HQHCM: 'TP. HCM',
};

function normalizeLoginData(data) {
  const loginData = data?.data ?? data;
  const token = loginData?.token;
  const user = loginData?.user ?? loginData;

  if (!token || !user) {
    return null;
  }

  return {
    token,
    user,
  };
}

function loadAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const auth = JSON.parse(raw);
      if (auth?.token && auth?.user) {
        localStorage.setItem('token', auth.token);
        localStorage.setItem('user', JSON.stringify(auth.user));
        localStorage.setItem(
          'userNode',
          auth.user.maCS ?? auth.user.ID_headquarter ?? '',
        );
        return auth;
      }
    }

    const token = localStorage.getItem('token');
    const userRaw = localStorage.getItem('user');

    if (!token || !userRaw) {
      return null;
    }

    const user = JSON.parse(userRaw);

    return {
      token,
      user,
    };
  } catch {
    return null;
  }
}

function saveAuth(auth) {
  if (!auth) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userNode');
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  localStorage.setItem('token', auth.token);
  localStorage.setItem('user', JSON.stringify(auth.user));
  localStorage.setItem(
    'userNode',
    auth.user.maCS ?? auth.user.ID_headquarter ?? '',
  );
}

export default function App() {
  const [auth, setAuth] = useState(() => loadAuth());
  const [currentPage, setCurrentPage] = useState('danh-sach-dang-ky');

  const handleLogin = (data) => {
    const nextAuth = normalizeLoginData(data);

    if (!nextAuth) {
      console.error('Dữ liệu đăng nhập không hợp lệ:', data);
      return;
    }

    saveAuth(nextAuth);
    setAuth(nextAuth);
  };

  const handleLogout = () => {
    saveAuth(null);
    setAuth(null);
    setCurrentPage('danh-sach-dang-ky');
  };

  const user = auth?.user;

  useEffect(() => {
    if (!user?.role) return;

    if (user.role === 'sinhvien') {
      setCurrentPage('danh-sach-dang-ky');
    } else if (user.role === 'quantrivien') {
      setCurrentPage('giam-sat-node');
    } else if (user.role === 'nhanvien') {
      setCurrentPage('quan-ly-du-lieu');
    } else {
      setCurrentPage('thong-ke');
    }
  }, [user?.role]);

  if (!auth?.token || !user) {
    return <Login onLogin={handleLogin} />;
  }

  const campusCode = user.maCS ?? user.ID_headquarter;
  const campusName = campusLabels[campusCode] ?? campusCode ?? 'Không xác định';

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Hệ thống đăng ký học phần</h1>
          <p className="subtitle">
            Xin chào {user.username ?? user.id ?? user.ID_user} • {user.role} •{' '}
            {campusName}
          </p>
        </div>
        <button type="button" className="secondary" onClick={handleLogout}>
          Đăng xuất
        </button>
      </header>

      {user.role === 'sinhvien' && (
        <>
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              marginBottom: '1.5rem',
              borderBottom: '2px solid #f0f0f0',
            }}
          >
            <button
              onClick={() => setCurrentPage('danh-sach-dang-ky')}
              style={{
                padding: '12px 20px',
                backgroundColor:
                  currentPage === 'danh-sach-dang-ky'
                    ? '#1976d2'
                    : 'transparent',
                color: currentPage === 'danh-sach-dang-ky' ? 'white' : '#666',
                border: 'none',
                borderBottom:
                  currentPage === 'danh-sach-dang-ky'
                    ? '3px solid #1976d2'
                    : 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight:
                  currentPage === 'danh-sach-dang-ky' ? 'bold' : 'normal',
                transition: 'all 0.3s',
              }}
            >
              Danh Sách Đăng Ký
            </button>

            <button
              onClick={() => setCurrentPage('thoi-khoa-bieu')}
              style={{
                padding: '12px 20px',
                backgroundColor:
                  currentPage === 'thoi-khoa-bieu' ? '#1976d2' : 'transparent',
                color: currentPage === 'thoi-khoa-bieu' ? 'white' : '#666',
                border: 'none',
                borderBottom:
                  currentPage === 'thoi-khoa-bieu'
                    ? '3px solid #1976d2'
                    : 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight:
                  currentPage === 'thoi-khoa-bieu' ? 'bold' : 'normal',
                transition: 'all 0.3s',
              }}
            >
              Thời Khóa Biểu
            </button>
          </div>

          {currentPage === 'danh-sach-dang-ky' && (
            <DanhSachDangKy user={user} />
          )}
          {currentPage === 'thoi-khoa-bieu' && <XemThoiKhoaBieu user={user} />}
        </>
      )}

      {(user.role === 'quantrivien' || user.role === 'nhanvien') && (
        <>
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              marginBottom: '1.5rem',
              borderBottom: '2px solid #f0f0f0',
            }}
          >
            {user.role === 'quantrivien' && (
              <button
                onClick={() => setCurrentPage('giam-sat-node')}
                style={{
                  padding: '12px 20px',
                  backgroundColor:
                    currentPage === 'giam-sat-node' ? '#1976d2' : 'transparent',
                  color: currentPage === 'giam-sat-node' ? 'white' : '#666',
                  border: 'none',
                  borderBottom:
                    currentPage === 'giam-sat-node'
                      ? '3px solid #1976d2'
                      : 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight:
                    currentPage === 'giam-sat-node' ? 'bold' : 'normal',
                  transition: 'all 0.3s',
                }}
              >
                Giám Sát Node
              </button>
            )}

            <button
              onClick={() => setCurrentPage('quan-ly-du-lieu')}
              style={{
                padding: '12px 20px',
                backgroundColor:
                  currentPage === 'quan-ly-du-lieu' ? '#1976d2' : 'transparent',
                color: currentPage === 'quan-ly-du-lieu' ? 'white' : '#666',
                border: 'none',
                borderBottom:
                  currentPage === 'quan-ly-du-lieu'
                    ? '3px solid #1976d2'
                    : 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight:
                  currentPage === 'quan-ly-du-lieu' ? 'bold' : 'normal',
                transition: 'all 0.3s',
              }}
            >
              Quản Lý Dữ Liệu
            </button>

            <button
              onClick={() => setCurrentPage('thong-ke')}
              style={{
                padding: '12px 20px',
                backgroundColor:
                  currentPage === 'thong-ke' ? '#1976d2' : 'transparent',
                color: currentPage === 'thong-ke' ? 'white' : '#666',
                border: 'none',
                borderBottom:
                  currentPage === 'thong-ke' ? '3px solid #1976d2' : 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: currentPage === 'thong-ke' ? 'bold' : 'normal',
                transition: 'all 0.3s',
              }}
            >
              Thống Kê
            </button>
          </div>

          {currentPage === 'giam-sat-node' && user.role === 'quantrivien' && (
            <GiamSatNode user={user} />
          )}

          {currentPage === 'quan-ly-du-lieu' && <QuanLyDuLieu user={user} />}

          {currentPage === 'thong-ke' && <ThongKe user={user} />}
        </>
      )}

      {user.role !== 'sinhvien' &&
        user.role !== 'quantrivien' &&
        user.role !== 'nhanvien' && (
          <section className="card">
            <h2>Chưa có giao diện cho vai trò này</h2>
            <p>
              Vui lòng đăng nhập bằng tài khoản sinh viên, nhân viên hoặc quản
              trị viên.
            </p>
          </section>
        )}
    </div>
  );
}
