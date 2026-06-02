import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../config/api.js';

const campusOptions = [
  { value: 'HQHD', label: 'Hà Đông' },
  { value: 'HQHL', label: 'Hòa Lạc' },
  { value: 'HQHCM', label: 'TP. HCM' }
];

function formatMessage(payload) {
  if (!payload) return '';
  if (payload instanceof Error) return payload.message;
  if (payload.node && payload.status === 'offline') {
    return `Node ${payload.node} đang offline.`;
  }
  return payload.message ?? 'Có lỗi xảy ra.';
}

function deduplicateMessages(messages) {
  if (!Array.isArray(messages)) {
    return messages;
  }
  return Array.from(new Set(messages)).join(' | ');
}

export default function DangKyHocPhan({ user }) {
  const [maLop, setMaLop] = useState('');
  const [maCSLop, setMaCSLop] = useState(user?.maCS ?? 'HQHD');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [classOptions, setClassOptions] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [classMessage, setClassMessage] = useState('');

  const campusLabel = useMemo(() => {
    const option = campusOptions.find(item => item.value === user?.maCS);
    return option ? option.label : user?.maCS;
  }, [user?.maCS]);

  useEffect(() => {
    let isActive = true;
    const fetchClasses = async () => {
      setLoadingClasses(true);
      setClassMessage('');
      try {
        const payload = await apiFetch(`/api/hocphan/classes?maCS=${maCSLop}`, maCSLop);
        const rows = payload.data ?? [];
        if (!isActive) return;
        setClassOptions(rows);
        const hasCurrent = rows.some(row => row.id_class === maLop);
        if (!hasCurrent) {
          setMaLop(rows[0]?.id_class ?? '');
        }
      } catch (error) {
        if (!isActive) return;
        setClassOptions([]);
        const msg = formatMessage(error);
        const dedupMsg = msg.includes(' | ')
          ? deduplicateMessages(msg.split(' | '))
          : msg;
        setClassMessage(dedupMsg);
      } finally {
        if (isActive) {
          setLoadingClasses(false);
        }
      }
    };

    fetchClasses();
    return () => {
      isActive = false;
    };
  }, [maCSLop, maLop]);

  const handleSubmit = async event => {
    event.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const payload = await apiFetch('/api/dangky', user?.maCS ?? 'HQHD', {
        method: 'POST',
        body: { maLop, maCSLop }
      });

      setResult({
        type: 'success',
        text: `Đăng ký thành công lớp ${payload.data.maLop} tại cơ sở ${payload.data.maCSLop ?? payload.data.maCS}.`
      });
      setMaLop('');
    } catch (error) {
      const msg = formatMessage(error);
      const dedupMsg = msg.includes(' | ')
        ? deduplicateMessages(msg.split(' | '))
        : msg;
      setResult({
        type: 'error',
        text: dedupMsg
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card">
      <h2>Đăng ký học phần</h2>
      <p className="subtitle">
        Cơ sở của bạn: <strong>{campusLabel}</strong>
      </p>

      <form className="form" onSubmit={handleSubmit}>
        <label>
          Mã lớp học phần
          <select
            value={maLop}
            onChange={event => setMaLop(event.target.value)}
            disabled={loadingClasses}
            required
          >
            <option value="">-- Chọn lớp học phần --</option>
            {classOptions.map(option => (
              <option key={option.id_class} value={option.id_class}>
                {option.id_class}
              </option>
            ))}
          </select>
        </label>

        <label>
          Cơ sở lớp học phần
          <select
            value={maCSLop ?? ''}
            onChange={event => setMaCSLop(event.target.value)}
          >
            {campusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {classMessage && <div className="alert">{classMessage}</div>}
        {!classMessage && !loadingClasses && classOptions.length === 0 && (
          <div className="alert">Không có lớp học phần tại cơ sở này.</div>
        )}

        {result && (
          <div className={result.type === 'success' ? 'alert success' : 'alert'}>
            {result.text}
          </div>
        )}

        <button type="submit" disabled={loading}>
          {loading ? 'Đang xử lý...' : 'Đăng ký'}
        </button>
      </form>
    </section>
  );
}
