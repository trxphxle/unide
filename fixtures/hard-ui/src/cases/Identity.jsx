import { useEffect, useState } from 'react';
import { FixedSizeList } from 'react-window';
import Case from '../Case.jsx';

const Row = ({ index, style }) => <div className="row" style={style}>Order #{1000 + index} · {index % 3 ? 'paid' : 'refunded'}</div>;

function Resorting() {
  const [items, setItems] = useState([['Lisbon', 31], ['Berlin', 22], ['Seoul', 18], ['Philadelphia', 12]]);
  useEffect(() => {
    const t = setInterval(() => setItems((xs) => [...xs].sort(() => Math.random() - 0.5)), 3000);
    return () => clearInterval(t);
  }, []);
  return <ul className="sorted">{items.map(([n, v]) => <li key={n}><span className="city">{n}</span><b>{v}</b></li>)}</ul>;
}

function Ticker() {
  const [v, setV] = useState(1043.2);
  useEffect(() => { const t = setInterval(() => setV((x) => +(x + (Math.random() - 0.5) * 3).toFixed(2)), 700); return () => clearInterval(t); }, []);
  return <div className="ticker">${v.toFixed(2)}</div>;
}

export default function Identity() {
  return (
    <>
      <Case id="I1" title="Virtualized list" how="Pin “Order #1040”, then scroll the list: its DOM node is reused for another row.">
        <FixedSizeList height={150} width={300} itemCount={500} itemSize={28}>{Row}</FixedSizeList>
      </Case>
      <Case id="I2" title="List that re-sorts every 3s" how="Pin “Seoul”. The rows shuffle every 3 seconds."><Resorting /></Case>
      <Case id="I3" title="Live-updating text" how="The price changes every 0.7s."><Ticker /></Case>
      <Case id="I4" title="Only exists below 600px wide" how="Make the window narrower than 600px to see the banner.">
        <div className="mobile-only">Install the app for offline access</div>
        <p className="desktop-note">(Nothing here at this width: the banner is display:none above 600px.)</p>
      </Case>
    </>
  );
}
