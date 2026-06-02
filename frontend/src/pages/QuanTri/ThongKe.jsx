import { useEffect, useMemo, useState } from 'react';
import { apiFetch, gatewayFetch } from '../../config/api.js';
import Pagination from '../../components/Pagination.jsx';

const CAMPUS_OPTIONS = [
  { key: 'HQHD', label: 'HÃ  ÄÃ´ng' },
  { key: 'HQHL', label: 'HÃ²a Láº¡c' },
  { key: 'HQHCM', label: 'TP. HCM' },
];

const DISTRIBUTED_QUERY_OPTIONS = [
  { key: 'q1', label: 'Q1 - Sá»‘ SV Ä‘Äƒng kÃ½ theo cÆ¡ sá»Ÿ' },
  { key: 'q2', label: 'Q2 - Há»c pháº§n Ä‘Äƒng kÃ½ nhiá»u nháº¥t' },
  { key: 'q3', label: 'Q3 - Danh sÃ¡ch Ä‘Äƒng kÃ½ chÃ©o cÆ¡ sá»Ÿ' },
  { key: 'q4', label: 'Q4 - Tá»· lá»‡ láº¥p Ä‘áº§y lá»›p há»c pháº§n' },
  { key: 'q5', label: 'Q5 - Sá»‘ lá»›p há»c pháº§n má»Ÿ theo khoa' },
  { key: 'q6', label: 'Q6 - Danh sÃ¡ch lá»›p há»c pháº§n cÃ²n chá»—' },
  { key: 'q7', label: 'Q7 - Khá»‘i lÆ°á»£ng giáº£ng dáº¡y giáº£ng viÃªn' },
];

const PAGE_SIZE = 10;

const QUICK_REPORTS = [
  { key: 'lophocphan', label: 'TÃ¬nh tráº¡ng lá»›p theo há»c ká»³', path: '/api/thongke/lophocphan', requiresTerm: true, supportsCampus: true },
];

function normalizeColumnName(column) {
  return String(column ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getDateParts(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (!match) return null;
  return {
    day: match[3],
    month: match[2],
    year: match[1],
    hour: match[4],
    minute: match[5]
  };
}

function formatDateValue(value) {
  const parts = getDateParts(value);
  if (parts) return `${parts.day}/${parts.month}/${parts.year}`;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN').format(date);
}

function formatTimeValue(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/(?:T|\s|^)(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (match) {
    return `${String(Number(match[1])).padStart(2, '0')}:${match[2]}`;
  }
  return text;
}

function formatDateTimeValue(value) {
  const parts = getDateParts(value);
  if (parts?.hour && parts?.minute) {
    return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
  }
  return formatDateValue(value);
}

function formatCellValue(column, value) {
  if (value === null || value === undefined || value === '') return '';

  const normalized = normalizeColumnName(column);
  if (
    normalized.includes('thoi gian') ||
    normalized.includes('registered') ||
    normalized.includes('cancelled') ||
    normalized.includes('ngaydangky') ||
    normalized.includes('ngayhuy')
  ) {
    return formatDateTimeValue(value);
  }

  if (
    normalized.includes('gio') ||
    normalized.includes('time') ||
    normalized.includes('giostart') ||
    normalized.includes('gioend')
  ) {
    return formatTimeValue(value);
  }

  if (
    normalized.includes('ngay') ||
    normalized.includes('date') ||
    normalized.includes('studydate')
  ) {
    return formatDateValue(value);
  }

  return String(value);
}

export default function ThongKe({ user }) {
  const [distributedKey, setDistributedKey] = useState('q1');
  const [distributedRows, setDistributedRows] = useState([]);
  const [distributedTitle, setDistributedTitle] = useState('');
  const [distributedLoading, setDistributedLoading] = useState(false);
  const [distributedError, setDistributedError] = useState('');

  const [pageDistributed, setPageDistributed] = useState(1);

  const [quickKey, setQuickKey] = useState('lophocphan');
  const [quickRows, setQuickRows] = useState([]);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState('');
  const [quickCampus, setQuickCampus] = useState('');
  const [quickTerm, setQuickTerm] = useState('');
  const [terms, setTerms] = useState([]);
  const [pageQuick, setPageQuick] = useState(1);

  const [lookupStudentId, setLookupStudentId] = useState('');
  const [lookupCampus, setLookupCampus] = useState('HQHD');
  const [lookupError, setLookupError] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [registrationRows, setRegistrationRows] = useState([]);
  const [timetableRows, setTimetableRows] = useState([]);
  const [pageRegistration, setPageRegistration] = useState(1);
  const [pageTimetable, setPageTimetable] = useState(1);

  const isCentralAdmin = user?.role === 'quantrivien' && user?.maCS === 'HQHD';
  const isAdmin = user?.role === 'quantrivien';

  useEffect(() => {
    if (!isAdmin) return;
    const fetchTerms = async () => {
      try {
        const data = isCentralAdmin
          ? await gatewayFetch('/api/admin/term?maCS=HQHD')
          : await apiFetch('/api/admin/term', user?.maCS ?? 'HQHD');
        if (data.success) {
          setTerms(data.data ?? []);
        }
      } catch {
        setTerms([]);
      }
    };
    fetchTerms();
  }, [isAdmin, isCentralAdmin, user?.maCS]);

  useEffect(() => {
    if (isCentralAdmin) return;
    if (user?.maCS) {
      setQuickCampus(user.maCS);
      setLookupCampus(user.maCS);
    }
  }, [isCentralAdmin, user?.maCS]);

  useEffect(() => {
    if (!terms.length || quickTerm) return;
    const first = terms[0]?.ID_term ?? terms[0]?.id_term ?? '';
    if (first) setQuickTerm(first);
  }, [terms, quickTerm]);

  const runDistributedQuery = async selectedKey => {
    if (!selectedKey) return;
    setDistributedLoading(true);
    setDistributedError('');
    try {
      const data = await gatewayFetch(`/api/thongke/distributed/${selectedKey}`);
      if (!data.success) {
        setDistributedRows([]);
        setDistributedTitle('');
        setDistributedError(data.message || 'KhÃ´ng cháº¡y Ä‘Æ°á»£c truy váº¥n.');
        return;
      }
      setDistributedKey(selectedKey);
      setDistributedRows(data.data ?? []);
      setDistributedTitle(data.meta?.title ?? '');
      setPageDistributed(1);
    } catch (err) {
      setDistributedRows([]);
      setDistributedTitle('');
      setDistributedError(err.message || 'KhÃ´ng cháº¡y Ä‘Æ°á»£c truy váº¥n.');
    } finally {
      setDistributedLoading(false);
    }
  };

  const runQuickReport = async selectedKey => {
    const report = QUICK_REPORTS.find(item => item.key === selectedKey);
    if (!report) return;
    if (report.requiresTerm && !quickTerm) {
      setQuickError('Cáº§n chá»n há»c ká»³.');
      return;
    }
    setQuickLoading(true);
    setQuickError('');
    try {
      const params = new URLSearchParams();
      if (report.requiresTerm) params.set('ID_term', quickTerm);
      if (report.supportsCampus && quickCampus) params.set('ID_headquarter', quickCampus);
      const query = params.toString();
      const path = query ? `${report.path}?${query}` : report.path;
      const data = isCentralAdmin
        ? await gatewayFetch(path)
        : await apiFetch(path, user?.maCS ?? 'HQHD');
      if (!data.success) {
        setQuickRows([]);
        setQuickTitle('');
        setQuickError(data.message || 'KhÃ´ng cháº¡y Ä‘Æ°á»£c bÃ¡o cÃ¡o.');
        return;
      }
      setQuickKey(selectedKey);
      setQuickRows(data.data ?? []);
      setQuickTitle(report.label);
      setPageQuick(1);
    } catch (err) {
      setQuickRows([]);
      setQuickTitle('');
      setQuickError(err.message || 'KhÃ´ng cháº¡y Ä‘Æ°á»£c bÃ¡o cÃ¡o.');
    } finally {
      setQuickLoading(false);
    }
  };

  const handleLookupStudent = async () => {
    const studentId = lookupStudentId.trim();
    if (!studentId) {
      setLookupError('Nháº­p mÃ£ sinh viÃªn.');
      return;
    }
    setLookupLoading(true);
    setLookupError('');
    try {
      const params = new URLSearchParams({ ID_student: studentId, ID_headquarter: lookupCampus });
      const fetcher = isCentralAdmin
        ? gatewayFetch
        : path => apiFetch(path, user?.maCS ?? 'HQHD');
      const results = await Promise.allSettled([
        fetcher(`/api/dangky/result?${params.toString()}`),
        fetcher(`/api/thoikhoabieu?${params.toString()}`)
      ]);
      const errors = [];
      let hasSuccessfulLookup = false;

      if (results[0].status === 'fulfilled' && results[0].value.success !== false) {
        const rows = results[0].value.data ?? [];
        setRegistrationRows(rows);
        hasSuccessfulLookup = hasSuccessfulLookup || rows.length > 0;
      } else {
        setRegistrationRows([]);
        errors.push(results[0].reason?.message || results[0].value?.message || 'Không tra cứu được đăng ký.');
      }

      if (results[1].status === 'fulfilled' && results[1].value.success !== false) {
        const rows = results[1].value.data ?? [];
        setTimetableRows(rows);
        hasSuccessfulLookup = hasSuccessfulLookup || rows.length > 0;
      } else {
        setTimetableRows([]);
        errors.push(results[1].reason?.message || results[1].value?.message || 'Không tra cứu được thời khóa biểu.');
      }

      if (errors.length && !hasSuccessfulLookup) {
        setLookupError(errors.join(' | '));
      }
      setPageRegistration(1);
      setPageTimetable(1);
    } catch (err) {
      setRegistrationRows([]);
      setTimetableRows([]);
      setLookupError(err.message || 'KhÃ´ng tra cá»©u Ä‘Æ°á»£c.');
    } finally {
      setLookupLoading(false);
    }
  };

  const distributedColumns = useMemo(
    () => (distributedRows[0] ? Object.keys(distributedRows[0]) : []),
    [distributedRows]
  );
  const distributedPageCount = Math.max(1, Math.ceil(distributedRows.length / PAGE_SIZE));
  const distributedPageRows = useMemo(
    () => distributedRows.slice((pageDistributed - 1) * PAGE_SIZE, pageDistributed * PAGE_SIZE),
    [distributedRows, pageDistributed]
  );

  const quickColumns = useMemo(
    () => (quickRows[0] ? Object.keys(quickRows[0]) : []),
    [quickRows]
  );
  const quickPageCount = Math.max(1, Math.ceil(quickRows.length / PAGE_SIZE));
  const quickPageRows = useMemo(
    () => quickRows.slice((pageQuick - 1) * PAGE_SIZE, pageQuick * PAGE_SIZE),
    [quickRows, pageQuick]
  );

  const registrationColumns = useMemo(
    () => (registrationRows[0] ? Object.keys(registrationRows[0]) : []),
    [registrationRows]
  );
  const registrationPageCount = Math.max(1, Math.ceil(registrationRows.length / PAGE_SIZE));
  const registrationPageRows = useMemo(
    () => registrationRows.slice((pageRegistration - 1) * PAGE_SIZE, pageRegistration * PAGE_SIZE),
    [registrationRows, pageRegistration]
  );

  const timetableColumns = useMemo(
    () => (timetableRows[0] ? Object.keys(timetableRows[0]) : []),
    [timetableRows]
  );
  const timetablePageCount = Math.max(1, Math.ceil(timetableRows.length / PAGE_SIZE));
  const timetablePageRows = useMemo(
    () => timetableRows.slice((pageTimetable - 1) * PAGE_SIZE, pageTimetable * PAGE_SIZE),
    [timetableRows, pageTimetable]
  );

  return (
    <div className="stack">
      {isAdmin && (
        <section className="card">
          <h3>BÃ¡o cÃ¡o nhanh</h3>
          <p className="subtitle">Tá»•ng há»£p nhanh theo cÃ¡c máº«u thá»‘ng kÃª sáºµn cÃ³.</p>
          {quickError && <div className="alert" style={{ marginTop: 12 }}>{quickError}</div>}

          <div style={{ marginTop: 16, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {QUICK_REPORTS.map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => runQuickReport(item.key)}
                disabled={quickLoading}
                className={quickKey === item.key ? 'primary' : 'secondary'}
                style={{ textAlign: 'left', padding: '12px 14px', whiteSpace: 'normal', lineHeight: 1.4 }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 12, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', alignItems: 'end' }}>
            {QUICK_REPORTS.find(item => item.key === quickKey)?.supportsCampus && (
              <label style={{ minWidth: 220 }}>
                CÆ¡ sá»Ÿ
                <select value={quickCampus} onChange={e => setQuickCampus(e.target.value)} disabled={!isCentralAdmin}>
                  {isCentralAdmin && <option value="">Táº¥t cáº£</option>}
                  {CAMPUS_OPTIONS.map(option => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
              </label>
            )}
            {QUICK_REPORTS.find(item => item.key === quickKey)?.requiresTerm && (
              <label style={{ minWidth: 260 }}>
                Há»c ká»³ (chá»n hoáº·c nháº­p)
                <select value={quickTerm} onChange={e => setQuickTerm(e.target.value)}>
                  <option value="">Chá»n há»c ká»³</option>
                  {terms.map(term => (
                    <option key={term.ID_term ?? term.id_term} value={term.ID_term ?? term.id_term}>
                      {term.name_term ?? term.ID_term}
                    </option>
                  ))}
                </select>
                <input
                  value={quickTerm}
                  onChange={e => setQuickTerm(e.target.value)}
                  placeholder="Nháº­p mÃ£ há»c ká»³ (VD: HK2024_1)"
                  style={{ marginTop: 8 }}
                />
              </label>
            )}
            <button type="button" className="primary" onClick={() => runQuickReport(quickKey)} disabled={quickLoading}>
              {quickLoading ? 'Äang táº£i...' : 'Tra cá»©u'}
            </button>
          </div>

          {quickTitle && (
            <p className="subtitle" style={{ marginTop: 12 }}>
              {quickTitle} - Tá»•ng dÃ²ng: {quickRows.length}
            </p>
          )}

          {quickRows.length > 0 && (
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {quickColumns.map(col => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quickPageRows.map((row, index) => (
                    <tr key={index}>
                      {quickColumns.map(col => (
                        <td key={col}>{formatCellValue(col, row[col])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {quickRows.length > 0 && (
            <Pagination page={pageQuick} pages={quickPageCount} onPageChange={setPageQuick} loading={quickLoading} />
          )}
        </section>
      )}

      {isAdmin && (
        <section className="card">
          <h3>Tra cá»©u theo sinh viÃªn</h3>
          <p className="subtitle">Tra cá»©u Ä‘Äƒng kÃ½ vÃ  thá»i khÃ³a biá»ƒu theo mÃ£ sinh viÃªn.</p>
          {lookupError && <div className="alert" style={{ marginTop: 12 }}>{lookupError}</div>}

          <div style={{ marginTop: 16, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', alignItems: 'end' }}>
            <label style={{ minWidth: 220 }}>
              MÃ£ sinh viÃªn
              <input value={lookupStudentId} onChange={e => setLookupStudentId(e.target.value)} placeholder="VD: B22ATTT003" />
            </label>
            <label style={{ minWidth: 220 }}>
              CÆ¡ sá»Ÿ
              <select value={lookupCampus} onChange={e => setLookupCampus(e.target.value)} disabled={!isCentralAdmin}>
                {CAMPUS_OPTIONS.map(option => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={handleLookupStudent} disabled={lookupLoading}>
              {lookupLoading ? 'Äang táº£i...' : 'Tra cá»©u'}
            </button>
          </div>

          {registrationRows.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4>Káº¿t quáº£ Ä‘Äƒng kÃ½</h4>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      {registrationColumns.map(col => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {registrationPageRows.map((row, index) => (
                      <tr key={index}>
                        {registrationColumns.map(col => (
                          <td key={col}>{formatCellValue(col, row[col])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={pageRegistration} pages={registrationPageCount} onPageChange={setPageRegistration} loading={lookupLoading} />
            </div>
          )}

          {registrationRows.length === 0 && timetableRows.length === 0 && !lookupLoading && (
            <p className="subtitle" style={{ marginTop: 12 }}>
              ChÆ°a cÃ³ dá»¯ liá»‡u.
            </p>
          )}

          {timetableRows.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4>Thá»i khÃ³a biá»ƒu</h4>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      {timetableColumns.map(col => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timetablePageRows.map((row, index) => (
                      <tr key={index}>
                        {timetableColumns.map(col => (
                          <td key={col}>{formatCellValue(col, row[col])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={pageTimetable} pages={timetablePageCount} onPageChange={setPageTimetable} loading={lookupLoading} />
            </div>
          )}
        </section>
      )}

      {isCentralAdmin && (
        <section className="card">
          <h3>Truy váº¥n phÃ¢n tÃ¡n</h3>
          <p className="subtitle">Cháº¡y nhanh 7 truy váº¥n phÃ¢n tÃ¡n theo Ä‘á» tÃ i.</p>
          {distributedError && <div className="alert" style={{ marginTop: 12 }}>{distributedError}</div>}

          <div style={{ marginTop: 16, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {DISTRIBUTED_QUERY_OPTIONS.map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => runDistributedQuery(item.key)}
                disabled={distributedLoading}
                className={distributedKey === item.key ? 'primary' : 'secondary'}
                style={{ textAlign: 'left', padding: '12px 14px', whiteSpace: 'normal', lineHeight: 1.4 }}
              >
                <strong>{item.label.split(' - ')[0]}</strong>
                <div style={{ fontSize: '0.9rem', opacity: 0.8, marginTop: 6 }}>
                  {item.label.split(' - ')[1]}
                </div>
              </button>
            ))}
          </div>

          {distributedTitle && (
            <p className="subtitle" style={{ marginTop: 12 }}>
              {distributedTitle} - Tá»•ng dÃ²ng: {distributedRows.length}
            </p>
          )}

          {distributedRows.length > 0 && (
            <>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {distributedColumns.map(col => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {distributedPageRows.map((row, index) => (
                      <tr key={index}>
                        {distributedColumns.map(col => (
                          <td key={col}>{formatCellValue(col, row[col])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={pageDistributed}
                pages={distributedPageCount}
                onPageChange={setPageDistributed}
                loading={distributedLoading}
              />
            </>
          )}
        </section>
      )}
    </div>
  );
}
