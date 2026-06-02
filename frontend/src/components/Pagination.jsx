export default function Pagination({ page, pages, onPageChange, loading }) {
  if (pages <= 1) return null;

  const range = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pages, page + 2);

  if (start > 1) {
    range.push(1);
    if (start > 2) range.push('...');
  }
  for (let i = start; i <= end; i += 1) range.push(i);
  if (end < pages) {
    if (end < pages - 1) range.push('...');
    range.push(pages);
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 8,
        marginTop: '1rem',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <button
        type="button"
        disabled={page <= 1 || loading}
        onClick={() => onPageChange(page - 1)}
        className="secondary"
      >
        Trước
      </button>

      {range.map((p, idx) =>
        p === '...' ? (
          <span key={idx} style={{ padding: '8px 4px' }}>
            ...
          </span>
        ) : (
          <button
            type="button"
            key={idx}
            disabled={loading}
            onClick={() => onPageChange(p)}
            style={{
              padding: '8px 12px',
              backgroundColor: p === page ? '#1976d2' : '#f0f0f0',
              color: p === page ? 'white' : 'black',
              border: p === page ? '1px solid #1976d2' : '1px solid #ddd',
              borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: p === page ? 'bold' : 'normal',
            }}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        disabled={page >= pages || loading}
        onClick={() => onPageChange(page + 1)}
        className="secondary"
      >
        Sau
      </button>
    </div>
  );
}
