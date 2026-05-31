import { useEffect, useMemo, useState } from 'react';

const NODE_OPTIONS = [
  { key: 'HQHD', label: 'Hà Đông' },
  { key: 'HQHL', label: 'Hòa Lạc' },
  { key: 'HQHCM', label: 'TP. Hồ Chí Minh' }
];

const NUMBER_TYPES = new Set(['int', 'bigint', 'smallint', 'tinyint', 'decimal', 'numeric', 'float', 'real']);

function normalizeValue(value, dataType) {
  if (value === '' || value === undefined) return null;
  if (value === null) return null;
  const type = String(dataType).toLowerCase();

  if (type === 'bit') {
    if (value === true || value === 'true' || value === 1 || value === '1') return true;
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    return null;
  }

  if (NUMBER_TYPES.has(type)) {
    const numericValue = Number(value);
    return Number.isNaN(numericValue) ? value : numericValue;
  }

  return value;
}

function formatValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function QuanLyDuLieu({ apiBase, token, user }) {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [nodeKey, setNodeKey] = useState(user?.maCS ?? 'HQHD');
  const [meta, setMeta] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({});
  const [editKeys, setEditKeys] = useState(null);

  const canPickNode = user?.role === 'quantrivien';

  const primaryKeys = useMemo(() => meta?.primaryKeys ?? [], [meta]);
  const primaryKeySet = useMemo(() => new Set(primaryKeys), [primaryKeys]);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const res = await fetch(`${apiBase}/api/admin/tables`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setTables(data.data ?? []);
          if (!selectedTable && data.data?.length) {
            setSelectedTable(data.data[0].key);
          }
        } else {
          setError(data.message || 'Không thể tải danh sách bảng dữ liệu.');
        }
      } catch (err) {
        setError('Có lỗi khi tải danh sách bảng dữ liệu: ' + err.message);
      }
    };

    fetchTables();
  }, [apiBase, token]);

  useEffect(() => {
    if (!selectedTable) return;

    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const query = canPickNode ? `?maCS=${nodeKey}` : '';
        const [metaRes, dataRes] = await Promise.all([
          fetch(`${apiBase}/api/admin/meta/${selectedTable}${query}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${apiBase}/api/admin/${selectedTable}${query}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        const metaData = await metaRes.json();
        const data = await dataRes.json();
        if (!metaData.success || !data.success) {
          setError(metaData.message || data.message || 'Không thể tải dữ liệu.');
          setMeta(null);
          setRows([]);
        } else {
          setMeta(metaData.data);
          setRows(data.data ?? []);
          setFormData({});
          setEditKeys(null);
        }
      } catch (err) {
        setError('Có lỗi khi tải dữ liệu: ' + err.message);
        setMeta(null);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [apiBase, token, selectedTable, nodeKey, canPickNode]);

  const handleInputChange = (columnName, value) => {
    setFormData(prev => ({
      ...prev,
      [columnName]: value
    }));
  };

  const resetForm = () => {
    setFormData({});
    setEditKeys(null);
  };

  const handleEdit = (row) => {
    const keys = {};
    primaryKeys.forEach(key => {
      keys[key] = row[key];
    });
    setEditKeys(keys);

    const nextForm = {};
    (meta?.columns ?? []).forEach(column => {
      if (column.isIdentity) return;
      nextForm[column.name] = row[column.name] ?? '';
    });
    setFormData(nextForm);
  };

  const handleDelete = async (row) => {
    if (!window.confirm('Bạn có chắc muốn xóa dòng này?')) return;
    if (!meta) return;

    const keys = {};
    primaryKeys.forEach(key => {
      keys[key] = row[key];
    });

    if (Object.keys(keys).length === 0) {
      alert('Không xác định được khóa để xóa.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/api/admin/${selectedTable}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          maCS: canPickNode ? nodeKey : undefined,
          keys
        })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || 'Xóa thất bại.');
        return;
      }
      setRows(prev => prev.filter(item => item !== row));
      resetForm();
    } catch (err) {
      alert('Có lỗi khi xóa: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!meta) return;

    const columns = meta.columns ?? [];
    const payload = {};
    columns.forEach(column => {
      if (column.isIdentity) return;
      if (editKeys && primaryKeySet.has(column.name)) return;
      payload[column.name] = normalizeValue(formData[column.name], column.dataType);
    });

    setSaving(true);
    try {
      const body = {
        maCS: canPickNode ? nodeKey : undefined,
        data: payload
      };

      let url = `${apiBase}/api/admin/${selectedTable}`;
      let method = 'POST';

      if (editKeys) {
        method = 'PUT';
        body.keys = editKeys;
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!data.success) {
        alert(data.message || 'Lưu thất bại.');
        return;
      }

      const refreshRes = await fetch(`${apiBase}/api/admin/${selectedTable}${canPickNode ? `?maCS=${nodeKey}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const refreshData = await refreshRes.json();
      if (refreshData.success) {
        setRows(refreshData.data ?? []);
      }
      resetForm();
    } catch (err) {
      alert('Có lỗi khi lưu: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const editableColumns = useMemo(
    () => (meta?.columns ?? []).filter(column => !column.isIdentity),
    [meta]
  );

  return (
    <div className="stack">
      <section className="card">
        <h2>Quản lý dữ liệu</h2>
        <p className="subtitle">Cập nhật danh mục cơ sở, sinh viên, giảng viên, học phần, lớp học phần và phòng học.</p>
        {error && <div className="alert" style={{ marginTop: '12px' }}>{error}</div>}

        <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          <label style={{ minWidth: '220px' }}>
            Bảng dữ liệu
            <select value={selectedTable} onChange={event => setSelectedTable(event.target.value)}>
              {tables.map(table => (
                <option key={table.key} value={table.key}>{table.label}</option>
              ))}
            </select>
          </label>

          <label style={{ minWidth: '220px' }}>
            Cơ sở
            <select value={nodeKey} onChange={event => setNodeKey(event.target.value)} disabled={!canPickNode}>
              {NODE_OPTIONS.map(option => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </label>

          {!canPickNode && (
            <p className="subtitle" style={{ width: '100%', marginTop: '4px' }}>
              Nhân viên chỉ được quản lý dữ liệu cơ sở của mình.
            </p>
          )}
        </div>
      </section>

      <section className="card">
        <div className="row">
          <h3>Danh sách dữ liệu</h3>
          <button type="button" className="secondary" onClick={() => {}} disabled>
            Tổng số: {rows.length}
          </button>
        </div>

        {loading ? (
          <p>Đang tải...</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {(meta?.columns ?? []).map(column => (
                    <th key={column.name}>{column.name}</th>
                  ))}
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    {(meta?.columns ?? []).map(column => (
                      <td key={column.name}>{formatValue(row[column.name])}</td>
                    ))}
                    <td>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button type="button" className="secondary" onClick={() => handleEdit(row)}>Sửa</button>
                        <button type="button" onClick={() => handleDelete(row)} disabled={saving}>Xóa</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={(meta?.columns?.length ?? 0) + 1} style={{ textAlign: 'center', color: '#777' }}>
                      Chưa có dữ liệu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h3>{editKeys ? 'Cập nhật dữ liệu' : 'Thêm mới dữ liệu'}</h3>
        <form className="form" onSubmit={handleSubmit}>
          {editableColumns.map(column => (
            <label key={column.name}>
              {column.name}
              {column.dataType === 'bit' ? (
                <select
                  value={
                    formData[column.name] === true
                      ? 'true'
                      : formData[column.name] === false
                        ? 'false'
                        : ''
                  }
                  onChange={event => handleInputChange(column.name, event.target.value === 'true')}
                  disabled={Boolean(editKeys && primaryKeySet.has(column.name))}
                >
                  <option value="">-</option>
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              ) : (
                <input
                  value={formData[column.name] ?? ''}
                  onChange={event => handleInputChange(column.name, event.target.value)}
                  disabled={Boolean(editKeys && primaryKeySet.has(column.name))}
                />
              )}
            </label>
          ))}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button type="submit" disabled={saving || loading}>
              {saving ? 'Đang lưu...' : editKeys ? 'Cập nhật' : 'Thêm mới'}
            </button>
            {editKeys && (
              <button type="button" className="secondary" onClick={resetForm}>
                Hủy chỉnh sửa
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
