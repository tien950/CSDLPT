import NodeStatusBar from '../../components/NodeStatusBar.jsx';

export default function GiamSatNode({ apiBase, token }) {
  return (
    <div className="stack">
      <section className="card">
        <h2>Bảng điều khiển quản trị</h2>
        <p className="subtitle">
          Theo dõi trạng thái 3 node SQL Server và làm mới tự động mỗi 10 giây.
        </p>
      </section>

      <NodeStatusBar apiBase={apiBase} token={token} />
    </div>
  );
}
