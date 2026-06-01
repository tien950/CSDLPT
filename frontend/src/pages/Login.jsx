import { useState } from 'react';
import { authFetch } from '../config/api.js';

const demoGroups = [
  {
    campus: 'HQHD',
    accounts: [
      { role: 'SV', username: 'b22cntt005', password: '123456' },
      { role: 'GV', username: 'gv_hd_01', password: 'gv123' },
      { role: 'NV', username: 'nv_hd_01', password: 'nv123' },
      { role: 'ADMIN', username: 'qtv_01', password: 'qtv123' },
    ],
  },
  {
    campus: 'HQHL',
    accounts: [
      { role: 'SV', username: 'b22attt005', password: '123456' },
      { role: 'GV', username: 'gv_hl_01', password: 'gv123' },
      { role: 'NV', username: 'nv_hl_01', password: 'nv123' },
      { role: 'ADMIN', username: 'qtv_hl_01', password: 'qtv123' },
    ],
  },
  {
    campus: 'HQHCM',
    accounts: [
      { role: 'SV', username: 'b22attt001', password: '123456' },
      { role: 'GV', username: 'gv_hcm_01', password: 'gv123' },
      { role: 'NV', username: 'nv_hcm_01', password: 'nv123' },
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
        throw new Error('Backend khong tra ve token dang nhap.');
      }
      onLogin(loginData);
    } catch (error) {
      setMessage(error.message ?? 'Co loi xay ra.');
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
        <h1>Dang nhap he thong</h1>
        <p className="subtitle">Dung tai khoan demo de trai nghiem</p>

        <form onSubmit={handleSubmit} className="form">
          <label>
            Tai khoan
            <input
              type="text"
              value={username}
              onChange={event => setUsername(event.target.value)}
              placeholder="b22cntt005"
              required
            />
          </label>

          <label>
            Mat khau
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
            {loading ? 'Dang dang nhap...' : 'Dang nhap'}
          </button>
        </form>

        <div className="demo-list">
          <p className="demo-title">Tai khoan mau (bam "Dien" de dien nhanh)</p>
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
                          Dien
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
