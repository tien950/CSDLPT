import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../config/api.js';
import Pagination from '../../components/Pagination.jsx';

const CAMPUS_OPTIONS = [
  { key: 'HQHD', label: 'Ha Dong' },
  { key: 'HQHL', label: 'Hoa Lac' },
  { key: 'HQHCM', label: 'TP. HCM' },
];
const PAGE_SIZE = 10;

const NUMBER_TYPES = new Set(['int', 'bigint', 'smallint', 'tinyint', 'decimal', 'numeric', 'float', 'real']);
const EXCLUDED_COLUMNS = new Set(['rowguid']);

const COLUMN_LABELS = {
  ID_headquarter: 'Ma co so',
  name_headquarter: 'Ten co so',
  address: 'Dia chi',
  ID_department: 'Ma khoa',
  name_department: 'Ten khoa',
  ID_student: 'Ma sinh vien',
  name_student: 'Ten sinh vien',
  date_of_birth: 'Ngay sinh',
  gender_student: 'Gioi tinh',
  address_student: 'Dia chi SV',
  phone_student: 'So dien thoai',
  year_of_admission: 'Nam nhap hoc',
  ID_teacher: 'Ma giang vien',
  name_teacher: 'Ten giang vien',
  degree: 'Hoc vi',
  address_teacher: 'Dia chi GV',
  phone_teacher: 'SDT giang vien',
  gender_teacher: 'Gioi tinh GV',
  ID_subject: 'Ma hoc phan',
  name_subject: 'Ten hoc phan',
  number_of_credit: 'So tin chi',
  ID_class: 'Ma lop hoc phan',
  group_number: 'Nhom',
  class_status: 'Trang thai lop',
  min_students: 'Si so toi thieu',
  max_students: 'Si so toi da',
  number_of_registration: 'So da dang ky',
  ID_room: 'Ma phong',
  name_room: 'Ten phong',
  capacity: 'Suc chua',
  ID_session: 'Ma buoi hoc',
  study_date: 'Ngay hoc',
  day_of_week: 'Thu',
  note: 'Ghi chu',
  ID_timeslot: 'Ma ca',
  shift_no: 'Ca hoc',
  start_time: 'Gio bat dau',
  end_time: 'Gio ket thuc',
  ID_term: 'Ma hoc ky',
  name_term: 'Ten hoc ky',
  year_start: 'Nam hoc',
  term_no: 'Hoc ky so',
  start_date: 'Ngay bat dau',
  end_date: 'Ngay ket thuc',
  reg_open: 'Mo dang ky',
  reg_close: 'Dong dang ky',
  ID_curriculum: 'Ma chuong trinh',
  curriculum_name: 'Ten chuong trinh',
};

function getColumnLabel(name) {
  return COLUMN_LABELS[name] ?? name;
}

function normalizeColumnName(name) {
  return String(name ?? '').toLowerCase();
}

function isDateColumn(column) {
  const name = normalizeColumnName(column?.name);
  const type = normalizeColumnName(column?.dataType);
  return ['date', 'datetime', 'datetime2', 'smalldatetime'].includes(type) || name.includes('date') || name.includes('birth');
}

function normalizeValue(value, dataType) {
  if (value === '' || value === undefined || value === null) return null;
  const type = String(dataType).toLowerCase();
  if (type === 'bit') return value === true || value === 'true' || value === 1 || value === '1';
  if (NUMBER_TYPES.has(type)) {
    const n = Number(value);
    return Number.isNaN(n) ? value : n;
  }
  return value;
}

function formatValue(value, column) {
  if (value === null || value === undefined) return '';
  if (isDateColumn(column)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return new Intl.DateTimeFormat('vi-VN').format(d);
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function toDateInputValue(value) {
  if (!value) return '';
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export default function QuanLyDuLieu({ user }) {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [campus, setCampus] = useState(user?.maCS ?? 'HQHD');
  const [meta, setMeta] = useState(null);
  const [rows, setRows] = useState([]);
  const [formData, setFormData] = useState({});
  const [editKeys, setEditKeys] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);

  const canPickCampus = user?.role === 'quantrivien' && user?.maCS === 'HQHD';
  const currentCampus = canPickCampus ? campus : (user?.maCS ?? campus);

  const primaryKeys = useMemo(() => meta?.primaryKeys ?? [], [meta]);
  const primaryKeySet = useMemo(() => new Set(primaryKeys), [primaryKeys]);
  const visibleColumns = useMemo(
    () => (meta?.columns ?? []).filter(col => !EXCLUDED_COLUMNS.has(String(col.name).toLowerCase())),
    [meta]
  );
  const editableColumns = useMemo(() => visibleColumns.filter(col => !col.isIdentity), [visibleColumns]);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const data = await apiFetch('/api/admin/tables', currentCampus);
        if (!data.success) {
          setError(data.message || 'Khong the tai danh sach bang.');
          return;
        }
        setTables(data.data ?? []);
        if (!selectedTable && data.data?.length) setSelectedTable(data.data[0].key);
      } catch (err) {
        setError('Loi tai danh sach bang: ' + err.message);
      }
    };
    fetchTables();
  }, [currentCampus, selectedTable]);

  useEffect(() => {
    if (!selectedTable) return;
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const query = canPickCampus ? `?maCS=${campus}` : '';
        const [metaData, data] = await Promise.all([
          apiFetch(`/api/admin/meta/${selectedTable}${query}`, currentCampus),
          apiFetch(`/api/admin/${selectedTable}${query}`, currentCampus),
        ]);
        if (!metaData.success || !data.success) {
          setMeta(null);
          setRows([]);
          setError(metaData.message || data.message || 'Khong the tai du lieu.');
          return;
        }
        setMeta(metaData.data);
        setRows(data.data ?? []);
        setFormData({});
        setEditKeys(null);
        setKeyword('');
        setPage(1);
      } catch (err) {
        setMeta(null);
        setRows([]);
        setError('Loi tai du lieu: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedTable, campus, canPickCampus, currentCampus]);

  const filteredRows = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(row =>
      visibleColumns.some(col => formatValue(row[col.name], col).toLowerCase().includes(q))
    );
  }, [rows, visibleColumns, keyword]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = useMemo(
    () => filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredRows, page]
  );

  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [page, pageCount]);

  const resetForm = () => {
    setFormData({});
    setEditKeys(null);
  };

  const handleEdit = row => {
    const keys = {};
    primaryKeys.forEach(key => { keys[key] = row[key]; });
    setEditKeys(keys);
    const next = {};
    editableColumns.forEach(col => {
      next[col.name] = isDateColumn(col) ? toDateInputValue(row[col.name]) : (row[col.name] ?? '');
    });
    setFormData(next);
  };

  const handleDelete = async row => {
    if (!window.confirm('Ban co chac muon xoa dong nay?')) return;
    const keys = {};
    primaryKeys.forEach(key => { keys[key] = row[key]; });
    if (Object.keys(keys).length === 0) return;
    setSaving(true);
    try {
      const payload = await apiFetch(`/api/admin/${selectedTable}`, currentCampus, {
        method: 'DELETE',
        body: { maCS: canPickCampus ? campus : undefined, keys },
      });
      if (!payload.success) {
        alert(payload.message || 'Xoa that bai.');
        return;
      }
      setRows(prev => prev.filter(item => item !== row));
      resetForm();
    } catch (err) {
      alert('Loi xoa: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (!meta) return;
    const payload = {};
    editableColumns.forEach(col => {
      if (editKeys && primaryKeySet.has(col.name)) return;
      payload[col.name] = normalizeValue(formData[col.name], col.dataType);
    });

    const body = { maCS: canPickCampus ? campus : undefined, data: payload };
    const method = editKeys ? 'PUT' : 'POST';
    if (editKeys) body.keys = editKeys;

    setSaving(true);
    try {
      const result = await apiFetch(`/api/admin/${selectedTable}`, currentCampus, { method, body });
      if (!result.success) {
        alert(result.message || 'Luu that bai.');
        return;
      }
      const query = canPickCampus ? `?maCS=${campus}` : '';
      const refresh = await apiFetch(`/api/admin/${selectedTable}${query}`, currentCampus);
      if (refresh.success) setRows(refresh.data ?? []);
      resetForm();
    } catch (err) {
      alert('Loi luu: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderField = column => {
    const type = normalizeColumnName(column.dataType);
    const name = column.name;
    const disabled = Boolean(editKeys && primaryKeySet.has(name));
    if (isDateColumn(column)) {
      return (
        <input type="date" value={formData[name] ?? ''} onChange={e => setFormData(prev => ({ ...prev, [name]: e.target.value }))} disabled={disabled} />
      );
    }
    if (type === 'bit') {
      return (
        <select value={formData[name] === true ? 'true' : formData[name] === false ? 'false' : ''} onChange={e => setFormData(prev => ({ ...prev, [name]: e.target.value === 'true' }))} disabled={disabled}>
          <option value="">-</option>
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      );
    }
    return (
      <input value={formData[name] ?? ''} onChange={e => setFormData(prev => ({ ...prev, [name]: e.target.value }))} disabled={disabled} />
    );
  };

  return (
    <div className="stack">
      <section className="card">
        <h2>Quan ly du lieu</h2>
        <p className="subtitle">Quan ly thong tin theo bang du lieu va co so.</p>
        {error && <div className="alert" style={{ marginTop: 12 }}>{error}</div>}

        <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <label style={{ minWidth: 220 }}>
            Bang du lieu
            <select value={selectedTable} onChange={e => setSelectedTable(e.target.value)}>
              {tables.map(table => (
                <option key={table.key} value={table.key}>{table.label}</option>
              ))}
            </select>
          </label>

          <label style={{ minWidth: 220 }}>
            Co so
            <select value={campus} onChange={e => setCampus(e.target.value)} disabled={!canPickCampus}>
              {CAMPUS_OPTIONS.map(option => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="card">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <h3>Danh sach du lieu</h3>
          <input
            placeholder="Tim nhanh trong bang..."
            value={keyword}
            onChange={e => { setKeyword(e.target.value); setPage(1); }}
            style={{ minWidth: 260 }}
          />
          <button type="button" className="secondary" disabled>Tong: {filteredRows.length}</button>
        </div>

        {loading ? (
          <p>Dang tai...</p>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {visibleColumns.map(col => <th key={col.name}>{getColumnLabel(col.name)}</th>)}
                    <th>Thao tac</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row, index) => (
                    <tr key={index}>
                      {visibleColumns.map(col => <td key={col.name}>{formatValue(row[col.name], col)}</td>)}
                      <td>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" className="secondary" onClick={() => handleEdit(row)}>Sua</button>
                          <button type="button" onClick={() => handleDelete(row)} disabled={saving}>Xoa</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={visibleColumns.length + 1} style={{ textAlign: 'center', color: '#777' }}>
                        Chua co du lieu.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pageCount} onPageChange={setPage} loading={loading} />
          </>
        )}
      </section>

      <section className="card">
        <h3>{editKeys ? 'Cap nhat du lieu' : 'Them moi du lieu'}</h3>
        <form className="form" onSubmit={handleSubmit}>
          {editableColumns.map(col => (
            <label key={col.name}>
              {getColumnLabel(col.name)}
              {renderField(col)}
            </label>
          ))}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button type="submit" disabled={saving || loading}>
              {saving ? 'Dang luu...' : editKeys ? 'Cap nhat' : 'Them moi'}
            </button>
            {editKeys && (
              <button type="button" className="secondary" onClick={resetForm}>
                Huy chinh sua
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
