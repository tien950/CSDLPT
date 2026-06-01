export default function Pagination({ page, pages, onPageChange, loading }) {
  if (pages <= 1) return null;

  const range = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pages, page + 2);

  if (start > 1) {
    range.push(1);
    if (start > 2) range.push('...');
  }

  for (let i = start; i <= end; i++) {
    range.push(i);
  }

  if (end < pages) {
    if (end < pages - 1) range.push('...');
    range.push(pages);
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      gap: '8px',
      marginTop: '2rem',
      alignItems: 'center'
    }}>
      <button
        disabled={page <= 1 || loading}
        onClick={() => onPageChange(page - 1)}
        style={{
          padding: '8px 12px',
          cursor: page <= 1 || loading ? 'not-allowed' : 'pointer',
          opacity: page <= 1 || loading ? 0.5 : 1
        }}
      >
        ← Trước
      </button>

      {range.map((p, idx) => (
        p === '...' ? (
          <span key={idx} style={{ padding: '8px 4px' }}>...</span>
        ) : (
          <button
            key={idx}
            disabled={loading}
            onClick={() => onPageChange(p)}
            style={{
              padding: '8px 12px',
              backgroundColor: p === page ? '#1976d2' : '#f0f0f0',
              color: p === page ? 'white' : 'black',
              border: p === page ? '1px solid #1976d2' : '1px solid #ddd',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: p === page ? 'bold' : 'normal'
            }}
          >
            {p}
          </button>
        )
      ))}

      <button
        disabled={page >= pages || loading}
        onClick={() => onPageChange(page + 1)}
        style={{
          padding: '8px 12px',
          cursor: page >= pages || loading ? 'not-allowed' : 'pointer',
          opacity: page >= pages || loading ? 0.5 : 1
        }}
      >
        Sau →
      </button>
    </div>
  );
}

