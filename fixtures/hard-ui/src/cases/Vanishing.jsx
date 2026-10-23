import { useRef, useState } from 'react';
import Case from '../Case.jsx';

// V1: opened by JavaScript on mouseenter, closed 150ms after mouseleave (so a CSS :hover trick can't keep it)
function HoverMenu() {
  const [open, setOpen] = useState(false);
  const t = useRef();
  return (
    <div onMouseEnter={() => { clearTimeout(t.current); setOpen(true); }} onMouseLeave={() => { t.current = setTimeout(() => setOpen(false), 150); }} style={{ position: 'relative', display: 'inline-block' }}>
      <span className="menu-trigger">Account ▾</span>
      {open && (
        <div className="hover-menu">
          <a href="#profile">Profile</a>
          <a href="#billing">Billing</a>
          <a href="#signout">Sign out</a>
        </div>
      )}
    </div>
  );
}

// V3: a toast that dismisses itself after 2.5s
function Toasts() {
  const [toasts, setToasts] = useState([]);
  const add = () => {
    const id = Date.now();
    setToasts((t) => [...t, { id, text: 'Saved. 3 files updated.' }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2500);
  };
  return (
    <>
      <button onClick={add}>Save</button>
      <div className="toast-area">{toasts.map((t) => <div key={t.id} className="toast">{t.text}</div>)}</div>
    </>
  );
}

// V4: a combobox whose list closes when the input loses focus
function Combo() {
  const [open, setOpen] = useState(false);
  return (
    <div className="combo">
      <input placeholder="Pick a city" onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} />
      {open && <ul role="listbox"><li>Berlin</li><li>Lisbon</li><li>Philadelphia</li><li>Seoul</li></ul>}
    </div>
  );
}

export default function Vanishing() {
  return (
    <>
      <Case id="V1" title="Hover menu opened by JS" how="Hover “Account”. Moving to the unide bar closes it."><HoverMenu /></Case>
      <Case id="V2" title="Tooltip (CSS :hover)" how="Hover the button. The tooltip fades in above it.">
        <span className="tip-wrap"><button>Export</button><span className="tip">Exports as CSV, max 10k rows</span></span>
      </Case>
      <Case id="V3" title="Toast that auto-dismisses" how="Press Save. The toast (bottom right) leaves after 2.5s."><Toasts /></Case>
      <Case id="V4" title="Dropdown that closes on blur" how="Click into the field. Clicking anything else (the unide bar too) closes the list."><Combo /></Case>
    </>
  );
}
