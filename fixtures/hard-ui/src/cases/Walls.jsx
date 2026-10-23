import { useEffect, useRef } from 'react';
import Case from '../Case.jsx';

// W1 and W2: the same card inside an open and a closed shadow root
function defineCards() {
  for (const [tag, mode] of [['open-card', 'open'], ['closed-card', 'closed']]) {
    if (customElements.get(tag)) continue;
    customElements.define(tag, class extends HTMLElement {
      constructor() {
        super();
        const r = this.attachShadow({ mode });
        r.innerHTML = `<style>.c{display:flex;gap:10px;align-items:center;padding:10px;border:1px solid #ddd;border-radius:8px}
          .c b{color:#6a4cff}.c button{margin-left:auto;padding:4px 10px;border-radius:6px;border:1px solid #6a4cff;background:#fff;color:#6a4cff}</style>
          <div class="c"><b>${mode} shadow</b><span>Inside a ${mode} root</span><button>Action</button></div>`;
      }
    });
  }
}
defineCards();

// W5: a bar chart drawn on a canvas
function Chart() {
  const ref = useRef();
  useEffect(() => {
    const c = ref.current, x = c.getContext('2d'), data = [12, 19, 7, 15, 22, 9];
    x.clearRect(0, 0, c.width, c.height);
    data.forEach((v, i) => { x.fillStyle = i === 4 ? '#ff4d6d' : '#6a4cff'; x.fillRect(16 + i * 46, 110 - v * 4, 30, v * 4); });
    x.fillStyle = '#333'; x.font = '11px sans-serif'; x.fillText('May is the red bar', 16, 14);
  }, []);
  return <canvas ref={ref} className="chart" width="300" height="120" />;
}

const SANDBOXED = `<body style="font:13px sans-serif;margin:8px"><button style="padding:4px 10px">Pay now</button> <span>cross-origin (sandboxed) frame</span></body>`;

export default function Walls() {
  return (
    <>
      <Case id="W1" title="Open shadow DOM" how="The card is inside an open shadow root."><open-card /></Case>
      <Case id="W2" title="Closed shadow DOM" how="Same card, closed root: the page's JavaScript can't look inside."><closed-card /></Case>
      <Case id="W3" title="Same-origin iframe" how="/frame.html from this app, in an iframe."><iframe src="/frame.html" title="same-origin" /></Case>
      <Case id="W4" title="Cross-origin iframe" how="A sandboxed frame (opaque origin): nothing inside is reachable."><iframe sandbox="allow-scripts" srcDoc={SANDBOXED} title="cross-origin" /></Case>
      <Case id="W5" title="Canvas chart" how="Point at the red bar. It's pixels on one canvas."><Chart /></Case>
      <Case id="W6" title="Inline SVG icon" how="Point at the bell's clapper (a path inside the svg).">
        <div className="icon-row">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1b1b1f" strokeWidth="1.8" strokeLinecap="round">
            <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
            <path className="clapper" d="M10 19a2 2 0 0 0 4 0" stroke="#ff4d6d" />
          </svg>
          <span>Notifications</span>
        </div>
      </Case>
    </>
  );
}
