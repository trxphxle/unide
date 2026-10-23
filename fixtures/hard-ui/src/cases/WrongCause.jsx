import { useEffect, useState } from 'react';
import styled from '@emotion/styled';
import clsx from 'clsx';
import '@picocss/pico/css/pico.conditional.min.css';
import Case from '../Case.jsx';

// C3: the class is made at runtime by Emotion (css-abc123), the style is written here
const Pill = styled.span`
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  background: #e6fffa;
  color: #036d5f;
  font-weight: 600;
`;

function Tags() {
  const [n, setN] = useState(0);
  useEffect(() => { const t = setInterval(() => setN((x) => x + 1), 2000); return () => clearInterval(t); }, []);
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <span className={clsx('tag', n % 2 === 0 && 'is-active')}>Design</span>
      <span className={clsx('tag', { 'is-warn': n % 3 === 0 })}>Review</span>
      <span className={clsx('tag')}>Shipped</span>
    </div>
  );
}

export default function WrongCause() {
  return (
    <>
      <Case id="C1" title="Gap comes from the parent" how="“Second” is 40px below “First”. The child has no margin: the parent's gap does it.">
        <div className="stack"><div className="stack-item">First</div><div className="stack-item">Second</div></div>
      </Case>
      <Case id="C2" title="Style from a component library default" how="Pico CSS sets this button's padding and colour (node_modules).">
        <div className="pico"><button>Library button</button></div>
      </Case>
      <Case id="C3" title="CSS-in-JS runtime class" how="An Emotion styled.span; its class is generated at runtime."><Pill>Active</Pill></Case>
      <Case id="C4" title="clsx conditional classes" how="Classes flip every 2s depending on state."><Tags /></Case>
      <Case id="C5" title="3-step CSS variable chain" how="background: var(--cta-bg) → --accent → --brand-violet (tokens.css)."><button className="cta">Upgrade</button></Case>
    </>
  );
}
