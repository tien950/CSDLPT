import NodeStatusBar from '../../components/NodeStatusBar.jsx';

export default function GiamSatNode({ user }) {
  return (
    <div className="stack">
      <section className="card">
        <h2>Bảng điều khiển quản trị</h2>
        <p className="subtitle">
          Theo dõi trạng thái 3 cơ sở SQL Server và tự động làm mới mỗi 10 giây.
        </p>
      </section>
      <NodeStatusBar maCS={user?.maCS} />
    </div>
  );
}
