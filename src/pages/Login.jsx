import { useState } from 'react';

export default function Login({ apiBase, onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async event => {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? 'Đăng nhập thất bại.');
      }

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
              placeholder="sv_hd_01"
              required
            />
          </label>

          <label>
            Mật khẩu
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="sv123"
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
            <li>sv_hd_01 / sv123</li>
            <li>sv_hl_01 / sv123</li>
            <li>sv_hcm_01 / sv123</li>
            <li>qtv_01 / qtv123</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
