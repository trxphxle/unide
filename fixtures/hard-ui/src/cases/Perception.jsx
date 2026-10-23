import { useEffect, useState } from 'react';
import Case from '../Case.jsx';

// P3: the image arrives late and pushes the text down
function LateImage() {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    const t = setTimeout(() => setSrc("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='110'%3E%3Crect width='300' height='110' fill='%23ffd29d'/%3E%3Ctext x='20' y='60' font-size='20' font-family='sans-serif'%3Elate image%3C/text%3E%3C/svg%3E"), 1500);
    return () => clearTimeout(t);
  }, []);
  return <div className="feed">{src && <img src={src} alt="" />}<p className="after-img">This line jumps down when the image loads.</p></div>;
}

export default function Perception() {
  return (
    <>
      <Case id="P1" title="Icon with padding inside its viewBox" how="The glyph only fills the middle half of its 24×24 box, so it looks small and off.">
        <button className="icon-btn">
          <svg width="20" height="20" viewBox="0 0 24 24"><rect x="7" y="9" width="10" height="10" rx="2" fill="#1b1b1f" /></svg>
          Archive
        </button>
      </Case>
      <Case id="P2" title="Text on a gradient / photo" how="White text over a light gradient and a pale photo: is it readable?">
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="hero">Summer collection</div>
          <div className="hero photo">Book a trip</div>
        </div>
      </Case>
      <Case id="P3" title="Layout shift on image load" how="Reload: the text under the image moves 1.5s after load."><LateImage /></Case>
      <Case id="P4" title="Long unbreakable text" how="A long URL and an ID push out of their box.">
        <div className="long">https://example.com/really/long/path/without/any/break/opportunities/at/all/whatsoever</div>
      </Case>
      <Case id="P5" title="Dropdown hidden under the sticky header" how="Scroll until this card is just under the top bar: the menu (z-index 10) slides under the bar (z-index 50).">
        <div className="under-sticky" style={{ marginTop: 70 }}>
          <button>Filters ▴</button>
          <div className="dd"><div>Only mine</div><div>Has comments</div><div>Updated this week</div></div>
        </div>
      </Case>
    </>
  );
}
