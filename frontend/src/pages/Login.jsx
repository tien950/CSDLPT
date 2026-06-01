import { useState } from 'react';
import { apiFetch } from '../config/api.js';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async event => {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const preferredCampus = localStorage.getItem('userNode') ?? 'HQHD';
      const payload = await apiFetch('/api/auth/login', preferredCampus, {
        method: 'POST',
        body: { username, password }
      });

      onLogin(payload.data);
    } catch (error) {
      setMessage(error.message ?? 'Có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="card">
        <h1>Đăng nhập hệ thống</h1>
        <p className="subtitle">Dùng tài khoản demo để trải nghiệm</p>

        <form onSubmit={handleSubmit} className="form">
          <label>
            Tài khoản
            <input
              type="text"
              value={username}
              onChange={event => setUsername(event.target.value)}
              placeholder="b22cntt005"
              required
            />
          </label>

          <label>
            Mật khẩu
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="123456"
              required
            />
          </label>

          {message && <div className="alert">{message}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <div className="demo-list">
          <p>Tài khoản mẫu:</p>
          <ul>
            <li><strong>Sinh viên:</strong> b22cntt005 / 123456</li>
            <li><strong>Sinh viên:</strong> b22attt005 / 123456</li>
            <li><strong>Sinh viên:</strong> b22attt001 / 123456</li>
            <li><strong>Giảng viên:</strong> gv_hd_01 / gv123</li>
            <li><strong>Nhân viên:</strong> nv_hl_01 / nv123</li>
            <li><strong>Nhân viên:</strong> nv_hd_01 / nv123</li>
            <li><strong>Nhân viên:</strong> nv_hcm_01 / nv123</li>
            <li><strong>Quản trị viên:</strong> qtv_01 / qtv123</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
