import { useState } from 'react';
import { authFetch } from '../config/api.js';

const demoGroups = [
  {
    campus: 'HQHD',
    accounts: [
      { role: 'SV', username: 'b22cntt005', password: '123456' },
      { role: 'GV', username: 'gv_hd_01', password: 'gv123' },
      { role: 'ADMIN', username: 'qtv_01', password: 'qtv123' },
    ],
  },
  {
    campus: 'HQHL',
    accounts: [
      { role: 'SV', username: 'b22attt005', password: '123456' },
      { role: 'GV', username: 'gv_hl_01', password: 'gv123' },
      { role: 'ADMIN', username: 'qtv_hl_01', password: 'qtv123' },
    ],
  },
  {
    campus: 'HQHCM',
    accounts: [
      { role: 'SV', username: 'b22attt001', password: '123456' },
      { role: 'GV', username: 'gv_hcm_01', password: 'gv123' },
      { role: 'ADMIN', username: 'qtv_hcm_01', password: 'qtv123' },
    ],
  },
];

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
      const payload = await authFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      const loginData = payload.data ?? payload;
      if (!loginData.token) {
        throw new Error('Backend không trả về token đăng nhập.');
      }
      onLogin(loginData);
    } catch (error) {
      setMessage(error.message ?? 'Có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  };

  const fillAccount = account => {
    setUsername(account.username);
    setPassword(account.password);
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
          <p className="demo-title">Tài khoản mẫu (bấm "Điền" để điền nhanh)</p>
          <div className="demo-grid">
            {demoGroups.map(group => (
              <section key={group.campus} className="demo-campus">
                <div className="demo-campus-head">
                  <strong>{group.campus}</strong>
                </div>

                <div className="demo-rows">
                  {group.accounts.map(account => (
                    <div key={`${group.campus}-${account.username}`} className="demo-row">
                      <div className="demo-row-text">
                        <span className="demo-role">{account.role}</span>
                        <code>{account.username}</code>
                        <span>/</span>
                        <code>{account.password}</code>
                      </div>

                      <div className="demo-row-actions">
                        <button
                          type="button"
                          className="secondary demo-mini-btn"
                          onClick={() => fillAccount(account)}
                        >
                          Điền
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
