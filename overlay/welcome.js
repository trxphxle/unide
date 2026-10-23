// The first time unide shows up in a project (this browser): one small card by the bar that says how it works.
import { root, esc, isMac, optClick } from './core.js';

const KEY = 'unide:welcomed';
const seen = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return true; } };
const remember = () => { try { localStorage.setItem(KEY, '1'); } catch { /* no storage: it just shows again */ } };

export function welcome() {
  if (seen() || /^unide-size:/.test(window.name || '') || window !== window.top) return;
  const card = document.createElement('div');
  card.className = 'welcome';
  card.innerHTML = `<b>unide is on</b>
    <ol><li><b>${esc(optClick)}</b> anything to pin it: a button, a word, a menu item, a 3D object</li>
    <li>Say what should change, or change it by hand on the card</li>
    <li><b>Return</b> keeps it · <b>${isMac ? '⌘' : 'Ctrl+'}Return</b> sends your pins to your agent</li></ol>
    <div class="row"><span class="small grow">The swirl in the corner opens the bar.</span><button class="mini primary" data-act="welcomed">Got it</button></div>`;
  root.append(card);
}
export function dismiss() { remember(); root.querySelector('.welcome')?.remove(); }
