import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../config/api.js';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN').format(date);
}

function formatTime(value) {
  if (!value) return '-';
  const text = String(value);
  const match = text.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function StatCard({ label, value, note }) {
  return (
    <div className="node">
      <div className="node-name" style={{ fontSize: '1.8rem', color: '#275efe' }}>{value}</div>
      <div style={{ fontWeight: 700, marginTop: 4 }}>{label}</div>
      {note && <div className="node-status">{note}</div>}
    </div>
  );
}

function StatusPill({ status }) {
  const normalized = String(status ?? '').toUpperCase();
  const className = normalized === 'OPEN' ? 'online' : normalized === 'CLOSED' ? 'offline' : '';
  const label = normalized === 'OPEN' ? 'Đang mở' : normalized === 'CLOSED' ? 'Đã đóng' : (status || '-');
  return <span className={`status-pill ${className}`}>{label}</span>;
}

export default function GiangVienTongQuan({ user }) {
  const [profile, setProfile] = useState(null);
  const [classes, setClasses] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const campus = user?.maCS ?? user?.ID_headquarter ?? 'HQHD';

  const stats = useMemo(() => {
    const totalClasses = classes.length;
    const totalSessions = schedule.length;
    const totalRegistered = classes.reduce((sum, item) => sum + safeNumber(item.number_of_registration), 0);
    const totalCapacity = classes.reduce((sum, item) => sum + safeNumber(item.max_students), 0);
    const openClasses = classes.filter(item => String(item.class_status).toUpperCase() === 'OPEN').length;

    return {
      totalClasses,
      totalSessions,
      totalRegistered,
      totalCapacity,
      openClasses
    };
  }, [classes, schedule]);

  const loadOverview = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch('/api/giangvien/me/overview', campus);
      if (!result.success) {
        setError(result.message || 'Không tải được dữ liệu giảng viên.');
        setProfile(null);
        setClasses([]);
        setSchedule([]);
        return;
      }

      const data = result.data ?? {};
      setProfile(data.profile ?? null);
      setClasses(data.classes ?? []);
      setSchedule(data.schedule ?? []);
    } catch (err) {
      setError(err.message || 'Không tải được dữ liệu giảng viên.');
      setProfile(null);
      setClasses([]);
      setSchedule([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [campus]);

  if (loading) {
    return (
      <section className="card">
        <p>Đang tải tổng quan giảng viên...</p>
      </section>
    );
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="row">
          <div>
            <h2>Tổng quan giảng viên</h2>
            <p className="subtitle">Lớp phụ trách, lịch dạy và sĩ số hiện tại tại cơ sở {campus}</p>
          </div>
          <button type="button" className="secondary" onClick={loadOverview}>
            Tải lại
          </button>
        </div>

        {error && <div className="alert">{error}</div>}

        {profile && (
          <div className="node-grid" style={{ marginTop: 16 }}>
            <div className="node">
              <div className="node-name">{profile.name_teacher ?? profile.ID_teacher}</div>
              <div className="node-status">Mã GV: {profile.ID_teacher}</div>
              <div className="node-status">Học vị: {profile.degree || '-'}</div>
            </div>
            <div className="node">
              <div className="node-name">{profile.name_department || 'Khoa chưa xác định'}</div>
              <div className="node-status">Mã khoa: {profile.ID_department || '-'}</div>
              <div className="node-status">SĐT: {profile.phone_teacher || '-'}</div>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Thống kê nhanh</h2>
        <div className="node-grid" style={{ marginTop: 16 }}>
          <StatCard label="Lớp phụ trách" value={stats.totalClasses} note={`${stats.openClasses} lớp đang mở`} />
          <StatCard label="Buổi dạy" value={stats.totalSessions} note="Theo lịch học đã xếp" />
          <StatCard label="Sinh viên đăng ký" value={stats.totalRegistered} note={`Tối đa ${stats.totalCapacity}`} />
        </div>
      </section>

      <section className="card">
        <h2>Lớp học phần phụ trách</h2>
        {classes.length === 0 ? (
          <p className="subtitle">Chưa có lớp học phần nào được gán cho giảng viên này.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã lớp</th>
                  <th>Học phần</th>
                  <th>Học kỳ</th>
                  <th>Nhóm</th>
                  <th>Sĩ số</th>
                  <th>Buổi</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {classes.map(item => (
                  <tr key={item.ID_class}>
                    <td><strong>{item.ID_class}</strong></td>
                    <td>
                      {item.name_subject}
                      <div className="subtitle">{item.ID_subject} - {item.number_of_credit ?? 0} tín chỉ</div>
                    </td>
                    <td>{item.name_term ?? item.ID_term}</td>
                    <td>{item.group_number ?? '-'}</td>
                    <td>{safeNumber(item.number_of_registration)} / {safeNumber(item.max_students)}</td>
                    <td>{safeNumber(item.session_count)}</td>
                    <td><StatusPill status={item.class_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Lịch dạy</h2>
        {schedule.length === 0 ? (
          <p className="subtitle">Chưa có lịch dạy được xếp.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Ca</th>
                  <th>Lớp</th>
                  <th>Học phần</th>
                  <th>Phòng</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map(item => (
                  <tr key={item.ID_session}>
                    <td>
                      <strong>{formatDate(item.study_date)}</strong>
                      <div className="subtitle">{item.day_of_week || '-'}</div>
                    </td>
                    <td>{formatTime(item.start_time)} - {formatTime(item.end_time)}<div className="subtitle">Ca {item.shift_no}</div></td>
                    <td>{item.ID_class}</td>
                    <td>{item.name_subject}</td>
                    <td>{item.name_room || item.ID_room}<div className="subtitle">{item.room_headquarter || ''}</div></td>
                    <td>{item.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
