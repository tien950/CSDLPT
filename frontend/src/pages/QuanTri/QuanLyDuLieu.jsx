import { useEffect, useMemo, useState } from 'react';

const NODE_OPTIONS = [
  { key: 'HQHD', label: 'Hà Đông' },
  { key: 'HQHL', label: 'Hòa Lạc' },
  { key: 'HQHCM', label: 'TP. Hồ Chí Minh' }
];

const NUMBER_TYPES = new Set(['int', 'bigint', 'smallint', 'tinyint', 'decimal', 'numeric', 'float', 'real']);
const EXCLUDED_COLUMNS = new Set(['rowguid']);
const GENDER_OPTIONS = [
  { value: 'Nam', label: 'Nam' },
  { value: 'Nữ', label: 'Nữ' },
  { value: 'Khác', label: 'Khác' }
];
const DEGREE_OPTIONS = [
  { value: 'Tiến sĩ', label: 'Tiến sĩ' },
  { value: 'Thạc sĩ', label: 'Thạc sĩ' },
  { value: 'Cử nhân', label: 'Cử nhân' },
  { value: 'Kỹ sư', label: 'Kỹ sư' },
  { value: 'Cao đẳng', label: 'Cao đẳng' },
  { value: 'Trung cấp', label: 'Trung cấp' }
];

function normalizeColumnName(name) {
  return String(name ?? '').toLowerCase();
}

function isGenderColumn(columnName) {
  const name = normalizeColumnName(columnName);
  return name.includes('gender') || name.includes('gioitinh') || name.includes('gioi_tinh') || name.includes('sex');
}

function isDepartmentColumn(columnName) {
  const name = normalizeColumnName(columnName);
  return name.includes('department') || name.includes('phong_ban') || name.includes('phongban');
}

function isCurriculumColumn(columnName) {
  const name = normalizeColumnName(columnName);
  return name.includes('curriculum') || name.includes('chuong_trinh') || name.includes('program');
}

function isDegreeColumn(columnName) {
  const name = normalizeColumnName(columnName);
  return name === 'degree' || name.includes('degree') || name.includes('trinh_do') || name.includes('trình_độ');
}

function isDateColumn(column) {
  const name = normalizeColumnName(column?.name);
  const type = normalizeColumnName(column?.dataType);
  return (
    ['date', 'datetime', 'datetime2', 'smalldatetime'].includes(type) ||
    name.includes('birth') ||
    name.includes('dob') ||
    name.includes('ngay_sinh') ||
    name.includes('birthday')
  );
}

function toDateInputValue(value) {
  if (value === null || value === undefined || value === '') return '';
  const stringValue = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) return stringValue;
  const match = stringValue.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const date = new Date(stringValue);
  if (Number.isNaN(date.getTime())) return stringValue;
  return date.toISOString().slice(0, 10);
}

function formatDateDisplay(value) {
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function getOptionValue(row) {
  if (row === null || row === undefined) return '';
  if (Object.prototype.hasOwnProperty.call(row, 'ID_department')) return row.ID_department ?? '';
  const idKey = Object.keys(row).find(key => normalizeColumnName(key).startsWith('id_'));
  if (idKey) return row[idKey] ?? '';
  return Object.values(row)[0] ?? '';
}

function getOptionLabel(row) {
  if (row === null || row === undefined) return '';
  const entries = Object.entries(row).filter(([key, value]) => {
    if (value === null || value === undefined || value === '') return false;
    return !EXCLUDED_COLUMNS.has(normalizeColumnName(key));
  });

  const idEntry = entries.find(([key]) => normalizeColumnName(key).startsWith('id_'));
  const labelEntry = entries.find(([key]) => !normalizeColumnName(key).startsWith('id_'));

  if (!idEntry && !labelEntry) return '';
  if (!idEntry) return String(labelEntry[1]);
  if (!labelEntry) return String(idEntry[1]);
  if (String(idEntry[1]) === String(labelEntry[1])) return String(idEntry[1]);
  return `${idEntry[1]} - ${labelEntry[1]}`;
}

function getCurriculumOptionValue(row) {
  if (row === null || row === undefined) return '';
  if (Object.prototype.hasOwnProperty.call(row, 'ID_curriculum')) return row.ID_curriculum ?? '';
  const idKey = Object.keys(row).find(key => normalizeColumnName(key).startsWith('id_'));
  if (idKey) return row[idKey] ?? '';
  return Object.values(row)[0] ?? '';
}

function getCurriculumOptionLabel(row) {
  if (row === null || row === undefined) return '';
  const preferredKeys = ['name_curriculum', 'curriculum_name', 'ten_curriculum', 'name_program', 'program_name'];
  for (const key of preferredKeys) {
    if (Object.prototype.hasOwnProperty.call(row, key) && row[key]) {
      return String(row[key]);
    }
  }
  return getOptionLabel(row) || String(getCurriculumOptionValue(row));
}

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

function formatValue(value, column) {
  if (value === null || value === undefined) return '';
  if (isDateColumn(column)) return formatDateDisplay(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function QuanLyDuLieu({ apiBase, token, user }) {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [nodeKey, setNodeKey] = useState(user?.maCS ?? 'HQHD');
  const [meta, setMeta] = useState(null);
  const [rows, setRows] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [curriculumOptions, setCurriculumOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({});
  const [editKeys, setEditKeys] = useState(null);

  const canPickNode = user?.role === 'quantrivien';

  const primaryKeys = useMemo(() => meta?.primaryKeys ?? [], [meta]);
  const primaryKeySet = useMemo(() => new Set(primaryKeys), [primaryKeys]);
  const visibleColumns = useMemo(
    () => (meta?.columns ?? []).filter(column => !EXCLUDED_COLUMNS.has(String(column.name).toLowerCase())),
    [meta]
  );

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

  useEffect(() => {
    const fetchDepartmentOptions = async () => {
      try {
        const query = canPickNode ? `?maCS=${nodeKey}` : '';
        const res = await fetch(`${apiBase}/api/admin/department${query}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setDepartmentOptions(data.data ?? []);
        } else {
          setDepartmentOptions([]);
        }
      } catch {
        setDepartmentOptions([]);
      }
    };

    fetchDepartmentOptions();
  }, [apiBase, token, nodeKey, canPickNode, selectedTable]);

  useEffect(() => {
    const fetchCurriculumOptions = async () => {
      try {
        const query = canPickNode ? `?maCS=${nodeKey}` : '';
        const res = await fetch(`${apiBase}/api/admin/curriculum${query}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setCurriculumOptions(data.data ?? []);
        } else {
          setCurriculumOptions([]);
        }
      } catch {
        setCurriculumOptions([]);
      }
    };

    fetchCurriculumOptions();
  }, [apiBase, token, nodeKey, canPickNode, selectedTable]);

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
    visibleColumns.forEach(column => {
      if (column.isIdentity) return;
      nextForm[column.name] = isDateColumn(column) ? toDateInputValue(row[column.name]) : (row[column.name] ?? '');
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

    const columns = visibleColumns;
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
    () => visibleColumns.filter(column => !column.isIdentity),
    [visibleColumns]
  );

  const renderField = (column) => {
    const type = normalizeColumnName(column.dataType);
    const fieldName = column.name;
    const isGender = isGenderColumn(fieldName);
    const isDepartment = isDepartmentColumn(fieldName);
    const isCurriculum = isCurriculumColumn(fieldName);
    const isDegree = isDegreeColumn(fieldName);
    const isDate = isDateColumn(column);

    if (isGender) {
      return (
        <select
          value={formData[fieldName] ?? ''}
          onChange={event => handleInputChange(fieldName, event.target.value)}
          disabled={Boolean(editKeys && primaryKeySet.has(fieldName))}
        >
          <option value="">-</option>
          {GENDER_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      );
    }

    if (isDepartment) {
      return (
        <select
          value={formData[fieldName] ?? ''}
          onChange={event => handleInputChange(fieldName, event.target.value)}
          disabled={Boolean(editKeys && primaryKeySet.has(fieldName))}
        >
          <option value="">-</option>
          {departmentOptions.map((option, index) => {
            const value = getOptionValue(option);
            const label = getOptionLabel(option) || String(value || `Mục ${index + 1}`);
            return (
              <option key={`${value}-${index}`} value={value}>
                {label}
              </option>
            );
          })}
        </select>
      );
    }

    if (isCurriculum) {
      return (
        <select
          value={formData[fieldName] ?? ''}
          onChange={event => handleInputChange(fieldName, event.target.value)}
          disabled={Boolean(editKeys && primaryKeySet.has(fieldName))}
        >
          <option value="">-</option>
          {curriculumOptions.map((option, index) => {
            const value = getCurriculumOptionValue(option);
            const label = getCurriculumOptionLabel(option) || String(value || `Mục ${index + 1}`);
            return (
              <option key={`${value}-${index}`} value={value}>
                {label}
              </option>
            );
          })}
        </select>
      );
    }

    if (isDegree) {
      return (
        <select
          value={formData[fieldName] ?? ''}
          onChange={event => handleInputChange(fieldName, event.target.value)}
          disabled={Boolean(editKeys && primaryKeySet.has(fieldName))}
        >
          <option value="">-</option>
          {DEGREE_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      );
    }

    if (isDate) {
      return (
        <input
          type="date"
          value={formData[fieldName] ?? ''}
          onChange={event => handleInputChange(fieldName, event.target.value)}
          disabled={Boolean(editKeys && primaryKeySet.has(fieldName))}
        />
      );
    }

    if (type === 'bit') {
      return (
        <select
          value={
            formData[fieldName] === true
              ? 'true'
              : formData[fieldName] === false
                ? 'false'
                : ''
          }
          onChange={event => handleInputChange(fieldName, event.target.value === 'true')}
          disabled={Boolean(editKeys && primaryKeySet.has(fieldName))}
        >
          <option value="">-</option>
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      );
    }

    return (
      <input
        value={formData[fieldName] ?? ''}
        onChange={event => handleInputChange(fieldName, event.target.value)}
        disabled={Boolean(editKeys && primaryKeySet.has(fieldName))}
      />
    );
  };

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
                  {visibleColumns.map(column => (
                    <th key={column.name}>{column.name}</th>
                  ))}
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    {visibleColumns.map(column => (
                      <td key={column.name}>{formatValue(row[column.name], column)}</td>
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
                    <td colSpan={visibleColumns.length + 1} style={{ textAlign: 'center', color: '#777' }}>
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
              {renderField(column)}
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
