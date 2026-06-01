import NodeStatusBar from '../../components/NodeStatusBar.jsx';

export default function GiamSatNode({ user }) {
  return (
    <div className="stack">
      <section className="card">
        <h2>Bang dieu khien quan tri</h2>
        <p className="subtitle">
          Theo doi trang thai 3 co so SQL Server va tu dong lam moi moi 10 giay.
        </p>
      </section>
      <NodeStatusBar maCS={user?.maCS} />
    </div>
  );
}
