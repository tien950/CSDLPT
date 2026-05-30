import { useMemo, useState } from 'react';
import Login from './pages/Login.jsx';
import DanhSachDangKy from './pages/SinhVien/DanhSachDangKy.jsx';
import GiamSatNode from './pages/QuanTri/GiamSatNode.jsx';

const STORAGE_KEY = 'csdlpt.auth';

function loadAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveAuth(auth) {
  if (!auth) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

const campusLabels = {
  HQHD: 'Hà Đông',
  HQHL: 'Hòa Lạc',
  HQHCM: 'TP. HCM'
};

export default function App() {
  const [auth, setAuth] = useState(() => loadAuth());
  const apiBase = useMemo(
    () => import.meta.env.VITE_API_BASE ?? 'http://localhost:4000',
    []
  );

  const handleLogin = data => {
    const nextAuth = {
      token: data.token,
      user: data.user
    };
    saveAuth(nextAuth);
    setAuth(nextAuth);
  };

  const handleLogout = () => {
    saveAuth(null);
    setAuth(null);
  };

  if (!auth?.token) {
    return <Login apiBase={apiBase} onLogin={handleLogin} />;
  }

  const { user } = auth;
  const campusName = campusLabels[user.maCS] ?? user.maCS;

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Hệ thống đăng ký học phần</h1>
          <p className="subtitle">
            Xin chào {user.username} • {user.role} • {campusName}
          </p>
        </div>
        <button type="button" className="secondary" onClick={handleLogout}>
          Đăng xuất
        </button>
      </header>

      {user.role === 'sinhvien' && (
        <DanhSachDangKy apiBase={apiBase} token={auth.token} />
      )}

      {user.role === 'quantrivien' && (
        <GiamSatNode apiBase={apiBase} token={auth.token} />
      )}

      {user.role !== 'sinhvien' && user.role !== 'quantrivien' && (
        <section className="card">
          <h2>Chưa có giao diện cho vai trò này</h2>
          <p>Vui lòng đăng nhập bằng tài khoản sinh viên hoặc quản trị viên.</p>
        </section>
      )}
    </div>
  );
}
