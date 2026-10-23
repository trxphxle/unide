import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Case from '../Case.jsx';

function PortalModal() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open modal</button>
      {open && createPortal(
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Delete project?</h3>
            <p>This modal is rendered into document.body through a portal.</p>
            <button className="danger" style={{ background: '#d33', color: '#fff', border: 0, padding: '6px 12px', borderRadius: 6 }} onClick={() => setOpen(false)}>Delete</button>
          </div>
        </div>, document.body)}
    </>
  );
}

function PortalDropdown() {
  const [rect, setRect] = useState(null);
  const ref = useRef();
  const toggle = () => setRect(rect ? null : ref.current.getBoundingClientRect());
  return (
    <>
      <button ref={ref} onClick={toggle}>Sort by ▾</button>
      {rect && createPortal(
        <div className="portal-dd" style={{ left: rect.left + scrollX, top: rect.bottom + scrollY + 4 }}>
          <div>Newest</div><div>Oldest</div><div>Most starred</div>
        </div>, document.body)}
    </>
  );
}

export default function WrongLayer() {
  return (
    <>
      <Case id="L1" title="Transparent overlay above a button" how="An invisible div covers the button. A click lands on the div.">
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button className="covered" style={{ padding: '6px 14px' }}>Covered button</button>
          <div className="cover" />
        </div>
      </Case>
      <Case id="L2" title="Portal-rendered modal" how="Open it. The modal lives at the end of <body>, far from this component's DOM."><PortalModal /></Case>
      <Case id="L3" title="Portal-rendered dropdown" how="Open it. The list is a child of <body>, positioned under the button."><PortalDropdown /></Case>
    </>
  );
}
