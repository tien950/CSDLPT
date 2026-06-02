import { useEffect, useState } from 'react';
import Login from './pages/Login.jsx';
import DanhSachDangKy from './pages/SinhVien/DanhSachDangKy.jsx';
import XemThoiKhoaBieu from './pages/SinhVien/XemThoiKhoaBieu.jsx';
import GiamSatNode from './pages/QuanTri/GiamSatNode.jsx';
import QuanLyDuLieu from './pages/QuanTri/QuanLyDuLieu.jsx';
import ThongKe from './pages/QuanTri/ThongKe.jsx';

const STORAGE_KEY = 'csdlpt.auth';

const campusLabels = {
  HQHD: 'Ha Dong',
  HQHL: 'Hoa Lac',
  HQHCM: 'TP. HCM',
};

function normalizeLoginData(data) {
  const loginData = data?.data ?? data;
  const token = loginData?.token;
  const user = loginData?.user ?? loginData;
  if (!token || !user) return null;
  return { token, user };
}

function loadAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const auth = JSON.parse(raw);
      if (auth?.token && auth?.user) {
        localStorage.setItem('token', auth.token);
        localStorage.setItem('user', JSON.stringify(auth.user));
        localStorage.setItem('userNode', auth.user.maCS ?? auth.user.ID_headquarter ?? '');
        return auth;
      }
    }

    const token = localStorage.getItem('token');
    const userRaw = localStorage.getItem('user');
    if (!token || !userRaw) return null;
    return { token, user: JSON.parse(userRaw) };
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
  localStorage.setItem('userNode', auth.user.maCS ?? auth.user.ID_headquarter ?? '');
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 20px',
        backgroundColor: active ? '#1976d2' : 'transparent',
        color: active ? 'white' : '#666',
        border: 'none',
        borderBottom: active ? '3px solid #1976d2' : 'none',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: active ? 'bold' : 'normal',
        transition: 'all 0.3s',
      }}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [auth, setAuth] = useState(() => loadAuth());
  const [currentPage, setCurrentPage] = useState('danh-sach-dang-ky');

  const handleLogin = data => {
    const nextAuth = normalizeLoginData(data);
    if (!nextAuth) return;
    saveAuth(nextAuth);
    setAuth(nextAuth);
  };

  const handleLogout = () => {
    saveAuth(null);
    setAuth(null);
    setCurrentPage('danh-sach-dang-ky');
  };

  const user = auth?.user;
  const isCentralAdmin = user?.role === 'quantrivien' && user?.maCS === 'HQHD';
  const canSeeThongKe = user?.role === 'quantrivien';

  useEffect(() => {
    if (!user?.role) return;
    if (user.role === 'sinhvien') {
      setCurrentPage('danh-sach-dang-ky');
      return;
    }
    if (user.role === 'quantrivien') {
      setCurrentPage(isCentralAdmin ? 'giam-sat-co-so' : 'quan-ly-du-lieu');
      return;
    }
    if (user.role === 'nhanvien') {
      setCurrentPage('quan-ly-du-lieu');
      return;
    }
    setCurrentPage('thong-ke');
  }, [user?.role, isCentralAdmin]);

  if (!auth?.token || !user) {
    return <Login onLogin={handleLogin} />;
  }

  const campusCode = user.maCS ?? user.ID_headquarter;
  const campusName = campusLabels[campusCode] ?? campusCode ?? 'Khong xac dinh';

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>He thong dang ky hoc phan</h1>
          <p className="subtitle">
            Xin chao {user.username ?? user.id ?? user.ID_user} • {user.role} • {campusName}
          </p>
        </div>
        <button type="button" className="secondary" onClick={handleLogout}>
          Dang xuat
        </button>
      </header>

      {user.role === 'sinhvien' && (
        <>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '2px solid #f0f0f0' }}>
            <TabButton active={currentPage === 'danh-sach-dang-ky'} onClick={() => setCurrentPage('danh-sach-dang-ky')}>
              Danh Sach Dang Ky
            </TabButton>
            <TabButton active={currentPage === 'thoi-khoa-bieu'} onClick={() => setCurrentPage('thoi-khoa-bieu')}>
              Thoi Khoa Bieu
            </TabButton>
          </div>
          {currentPage === 'danh-sach-dang-ky' && <DanhSachDangKy user={user} />}
          {currentPage === 'thoi-khoa-bieu' && <XemThoiKhoaBieu user={user} />}
        </>
      )}

      {(user.role === 'quantrivien' || user.role === 'nhanvien') && (
        <>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '2px solid #f0f0f0' }}>
            {isCentralAdmin && (
              <TabButton active={currentPage === 'giam-sat-co-so'} onClick={() => setCurrentPage('giam-sat-co-so')}>
                Giam Sat Co So
              </TabButton>
            )}
            <TabButton active={currentPage === 'quan-ly-du-lieu'} onClick={() => setCurrentPage('quan-ly-du-lieu')}>
              Quan Ly Du Lieu
            </TabButton>
            {canSeeThongKe && (
              <TabButton active={currentPage === 'thong-ke'} onClick={() => setCurrentPage('thong-ke')}>
                Thong Ke
              </TabButton>
            )}
          </div>

          {currentPage === 'giam-sat-co-so' && isCentralAdmin && <GiamSatNode user={user} />}
          {currentPage === 'quan-ly-du-lieu' && <QuanLyDuLieu user={user} />}
          {currentPage === 'thong-ke' && canSeeThongKe && <ThongKe user={user} />}
        </>
      )}

      {user.role !== 'sinhvien' && user.role !== 'quantrivien' && user.role !== 'nhanvien' && (
        <section className="card">
          <h2>Chua co giao dien cho vai tro nay</h2>
        </section>
      )}
    </div>
  );
}
