import { useEffect, useState } from 'react';
import { apiFetch } from '../../config/api.js';

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

function groupScheduleByDay(schedules) {
  // Group by day first
  const byDay = {};

  schedules.forEach(session => {
    if (!session.ngayHoc) return;

    const date = new Date(session.ngayHoc);
    const dayOfWeek = date.getDay();
    const dayNum = dayOfWeek === 0 ? 7 : dayOfWeek;
    const dayName = getDayOfWeekName(dayNum);

    if (!byDay[dayNum]) {
      byDay[dayNum] = {
        dayNum,
        dayName,
        slots: []
      };
    }

    byDay[dayNum].slots.push(session);
  });

  // Convert to array and sort by dayNum
  return Object.values(byDay).sort((a, b) => a.dayNum - b.dayNum);
}

export default function XemThoiKhoaBieu({ user }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentWeek, setCurrentWeek] = useState(0);
  const [groupedSchedules, setGroupedSchedules] = useState([]);

  useEffect(() => {
    fetchSchedule();
  }, []);

  useEffect(() => {
    const grouped = groupScheduleByDay(schedules);
    setGroupedSchedules(grouped);
  }, [schedules]);

  const fetchSchedule = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/api/sinhvien/schedule', user?.maCS ?? 'HQHD');

      if (!data?.success) {
        setError(data?.message || 'Không thể tải thời khóa biểu.');
        setSchedules([]);
      } else {
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
            Tổng số tiết học: <strong>{groupedSchedules.reduce((sum, day) => sum + day.slots.length, 0)}</strong>
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
                {groupedSchedules.map((dayGroup, dayIdx) => (
                  dayGroup.slots.map((session, sessionIdx) => (
                    <tr
                      key={`${dayIdx}-${sessionIdx}`}
                      style={{
                        borderBottom: '1px solid #eee',
                        backgroundColor: dayIdx % 2 === 0 ? '#f9f9f9' : 'white'
                      }}
                    >
                      {sessionIdx === 0 && (
                        <td
                          rowSpan={dayGroup.slots.length}
                          style={{
                            padding: '12px 8px',
                            fontWeight: 'bold',
                            color: '#1976d2'
                          }}
                        >
                          {dayGroup.dayName}
                        </td>
                      )}
                      <td style={{
                        padding: '12px 8px',
                        color: '#d32f2f'
                      }}>
                        {(() => {
                          const start = formatTime(session.gioStart);
                          const end = formatTime(session.gioEnd);
                          return `${start} - ${end}`;
                        })()}
                      </td>
                      <td style={{
                        padding: '12px 8px'
                      }}>
                        <strong>{session.tenMonHoc}</strong>
                        <div style={{ fontSize: '0.85rem', color: '#666' }}>
                          ca {session.caHoc} (Mã lớp: {session.ID_class})
                        </div>
                      </td>
                      <td style={{
                        padding: '12px 8px'
                      }}>
                        {session.giangVien}
                      </td>
                      <td style={{
                        padding: '12px 8px',
                        backgroundColor: '#e3f2fd'
                      }}>
                        <strong>{session.phongHoc}</strong>
                      </td>
                      <td style={{
                        padding: '12px 8px',
                        fontSize: '0.9rem'
                      }}>
                        {formatDate(session.ngayHoc)}
                      </td>
                      <td style={{
                        padding: '12px 8px',
                        fontSize: '0.85rem',
                        color: '#666',
                        fontStyle: 'italic'
                      }}>
                        {session.ghiChu || '-'}
                      </td>
                    </tr>
                  ))
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
