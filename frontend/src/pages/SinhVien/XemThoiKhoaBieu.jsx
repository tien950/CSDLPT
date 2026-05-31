import { useEffect, useState } from 'react';

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

function formatTime(timeStr) {
  if (!timeStr) return '-';
  try {
    // Try to extract HH:MM:SS directly from string (handles TIME format "09:15:00")
    const match = timeStr.match(/(\d{1,2}):(\d{2}):(\d{2})/);
    if (match) {
      const hours = String(parseInt(match[1], 10)).padStart(2, '0');
      const minutes = String(parseInt(match[2], 10)).padStart(2, '0');
      return `${hours}:${minutes}`;
    }

    // Fallback: parse ISO date and adjust for Vietnam timezone (UTC+7)
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return timeStr;

    const vietnamTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const hours = String(vietnamTime.getUTCHours()).padStart(2, '0');
    const minutes = String(vietnamTime.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return timeStr;
  }
}

function getDayOfWeekName(dayNum) {
  const days = ['', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
  return days[dayNum] || `Thứ ${dayNum}`;
}

function getWeekDays(baseDate = new Date()) {
  const date = new Date(baseDate);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    weekDays.push(d);
  }
  return weekDays;
}

function groupScheduleByWeek(schedules) {
  const grouped = {};

  schedules.forEach(session => {
    if (!session.ngayHoc) return;

    const date = new Date(session.ngayHoc);
    const dayOfWeek = date.getDay();
    const dayNum = dayOfWeek === 0 ? 7 : dayOfWeek;
    const formattedStart = formatTime(session.gioStart);
    const formattedEnd = formatTime(session.gioEnd);
    const time = `${formattedStart} - ${formattedEnd}`;
    const key = `${dayNum}_${time}`;

    if (!grouped[key]) {
      grouped[key] = {
        dayNum,
        dayName: getDayOfWeekName(dayNum),
        time,
        sessions: []
      };
    }

    grouped[key].sessions.push(session);
  });

  return Object.values(grouped).sort((a, b) => {
    if (a.dayNum !== b.dayNum) return a.dayNum - b.dayNum;
    return a.time.localeCompare(b.time);
  });
}

export default function XemThoiKhoaBieu({ apiBase, token }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentWeek, setCurrentWeek] = useState(0);
  const [groupedSchedules, setGroupedSchedules] = useState([]);

  useEffect(() => {
    fetchSchedule();
  }, []);

  useEffect(() => {
    const grouped = groupScheduleByWeek(schedules);
    setGroupedSchedules(grouped);
  }, [schedules]);

  const fetchSchedule = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/api/sinhvien/schedule`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.message || 'Không thể tải thời khóa biểu.');
        setSchedules([]);
      } else {
        // Map Vietnamese column names from stored procedure
        const mapped = (data.data || []).map(row => ({
          ID_session: row['Mã buổi học'] ?? row.ID_session ?? row.id_session,
          ID_class: row['Mã lớp học phần'] ?? row.ID_class ?? row.id_class,
          ngayHoc: row['Ngày học'] ?? row.ngayHoc ?? row.studyDate,
          thuHoc: row['Thứ'] ?? row.thuHoc ?? row.dayOfWeek,
          caHoc: row['Ca học'] ?? row.caHoc ?? row.shiftNo,
          gioStart: row['Giờ bắt đầu'] ?? row.gioStart ?? row.startTime,
          gioEnd: row['Giờ kết thúc'] ?? row.gioEnd ?? row.endTime,
          phongHoc: row['Phòng học'] ?? row.phongHoc ?? row.room_name,
          tenMonHoc: row['Tên học phần'] ?? row.tenMonHoc ?? row.subject_name,
          giangVien: row['Giảng viên'] ?? row.giangVien ?? row.teacher_name,
          ghiChu: row['Ghi chú'] ?? row.ghiChu ?? row.remark,
          node: row['Cơ sở học'] ?? row.node ?? row.maCS
        }));
        setSchedules(mapped);
      }
    } catch (err) {
      setError('Có lỗi khi tải dữ liệu: ' + err.message);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <section className="card"><p>Đang tải thời khóa biểu...</p></section>;

  return (
    <section className="card">
      <h2>Thời Khóa Biểu Môn Học</h2>

      {error && <div className="alert">{error}</div>}

      {schedules.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
          <p>Bạn chưa đăng ký môn học nào.</p>
        </div>
      ) : (
        <div>
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>
            Tổng số tiết học: <strong>{groupedSchedules.length}</strong>
          </p>

          <div style={{
            overflowX: 'auto',
            marginTop: '1rem'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: '900px'
            }}>
              <thead>
                <tr style={{
                  backgroundColor: '#1976d2',
                  color: 'white',
                  borderBottom: '2px solid #1976d2'
                }}>
                  <th style={{
                    padding: '12px 8px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    width: '10%'
                  }}>Thứ</th>
                  <th style={{
                    padding: '12px 8px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    width: '10%'
                  }}>Tiết</th>
                  <th style={{
                    padding: '12px 8px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    width: '22%'
                  }}>Môn Học</th>
                  <th style={{
                    padding: '12px 8px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    width: '16%'
                  }}>Giảng Viên</th>
                  <th style={{
                    padding: '12px 8px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    width: '12%'
                  }}>Phòng</th>
                  <th style={{
                    padding: '12px 8px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    width: '12%'
                  }}>Ngày Học</th>
                  <th style={{
                    padding: '12px 8px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    width: '18%'
                  }}>Ghi Chú</th>
                </tr>
              </thead>
              <tbody>
                {groupedSchedules.map((slot, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid #eee',
                      backgroundColor: idx % 2 === 0 ? '#f9f9f9' : 'white'
                    }}
                  >
                    <td style={{
                      padding: '12px 8px',
                      fontWeight: 'bold',
                      color: '#1976d2'
                    }}>
                      {slot.dayName}
                    </td>
                    <td style={{
                      padding: '12px 8px',
                      color: '#d32f2f'
                    }}>
                      {slot.time}
                    </td>
                    <td style={{
                      padding: '12px 8px'
                    }}>
                      {slot.sessions.map((s, i) => (
                        <div key={i} style={{ marginBottom: i < slot.sessions.length - 1 ? '8px' : '0' }}>
                          <strong>{s.tenMonHoc}</strong>
                          <div style={{ fontSize: '0.85rem', color: '#666' }}>
                            ca {s.caHoc} (Mã lớp: {s.ID_class})
                          </div>
                        </div>
                      ))}
                    </td>
                    <td style={{
                      padding: '12px 8px'
                    }}>
                      {slot.sessions.map((s, i) => (
                        <div key={i} style={{ marginBottom: i < slot.sessions.length - 1 ? '8px' : '0' }}>
                          {s.giangVien}
                        </div>
                      ))}
                    </td>
                    <td style={{
                      padding: '12px 8px',
                      backgroundColor: '#e3f2fd'
                    }}>
                      {slot.sessions.map((s, i) => (
                        <div key={i} style={{ marginBottom: i < slot.sessions.length - 1 ? '8px' : '0' }}>
                          <strong>{s.phongHoc}</strong>
                        </div>
                      ))}
                    </td>
                    <td style={{
                      padding: '12px 8px',
                      fontSize: '0.9rem'
                    }}>
                      {slot.sessions.map((s, i) => (
                        <div key={i} style={{ marginBottom: i < slot.sessions.length - 1 ? '8px' : '0' }}>
                          {formatDate(s.ngayHoc)}
                        </div>
                      ))}
                    </td>
                    <td style={{
                      padding: '12px 8px',
                      fontSize: '0.85rem',
                      color: '#666',
                      fontStyle: 'italic'
                    }}>
                      {slot.sessions.map((s, i) => (
                        <div key={i} style={{ marginBottom: i < slot.sessions.length - 1 ? '8px' : '0' }}>
                          {s.ghiChu || '-'}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {groupedSchedules.length === 0 && (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              marginTop: '1rem',
              color: '#999'
            }}>
              Không có lịch học nào trong tuần này.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
