import EmptyState from '../components/EmptyState';

export default function BoardPage() {
  return (
    <>
      <h1 className="visually-hidden">Ride board</h1>
      <div className="board-columns">
        <section className="board-column board-column--drivers">
          <h2 className="board-column-title">🚗 Drivers offering rides</h2>
          <EmptyState
            title="No rides posted yet"
            hint="Board opens soon — v2 under construction"
          />
        </section>
        <section className="board-column board-column--riders">
          <h2 className="board-column-title">🎒 Riders looking for rides</h2>
          <EmptyState
            title="No rides posted yet"
            hint="Board opens soon — v2 under construction"
          />
        </section>
      </div>
    </>
  );
}
