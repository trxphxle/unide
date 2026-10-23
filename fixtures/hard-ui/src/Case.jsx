// One labelled case: an id you can quote (V1, W3…), what it is, and how to make it appear.
export default function Case({ id, title, how, children }) {
  return (
    <section className="case" id={id}>
      <header className="case-head">
        <span className="case-id">{id}</span>
        <h3>{title}</h3>
      </header>
      {how && <p className="how">{how}</p>}
      <div className="stage">{children}</div>
    </section>
  );
}
