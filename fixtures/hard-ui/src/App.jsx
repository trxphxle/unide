import Vanishing from './cases/Vanishing.jsx';
import NonElements from './cases/NonElements.jsx';
import Walls from './cases/Walls.jsx';
import WrongLayer from './cases/WrongLayer.jsx';
import Identity from './cases/Identity.jsx';
import WrongCause from './cases/WrongCause.jsx';
import Perception from './cases/Perception.jsx';

const GROUPS = [
  ['vanishing', 'Vanishing UI', Vanishing],
  ['non-elements', 'Non-elements', NonElements],
  ['walls', 'Walls', Walls],
  ['wrong-layer', 'Wrong layer', WrongLayer],
  ['identity', 'Identity', Identity],
  ['wrong-cause', 'Wrong cause', WrongCause],
  ['perception', 'Perception', Perception],
];

export default function App() {
  return (
    <>
      <header className="sticky-top">
        <b>Hard UI</b>
        <nav>{GROUPS.map(([k, label]) => <a key={k} href={`#${k}`}>{label}</a>)}</nav>
      </header>
      <main>
        <p className="intro">Each case is something people want to point at that is hard to pin. The id (V1, N2…) matches fixtures/hard-ui/RESULTS.md.</p>
        {GROUPS.map(([k, label, Group]) => (
          <div key={k} className="group" id={k}>
            <h2>{label}</h2>
            <div className="cases"><Group /></div>
          </div>
        ))}
      </main>
    </>
  );
}
