// The bar (folded into a dot while idle, see dock.js) and the overlay's one set of listeners.
import { root, $, actions, inputs, changes, setRender, optKey, optClick, isMac } from './core.js';
import { CSS, LOGO, FONTS } from './styles.js';
import { toggleFreeze } from './freeze.js';
import * as sizes from './sizes.js';
import { dismiss as welcomed } from './welcome.js';

root.innerHTML = `<style>${CSS}</style>
  <div class="hl hover"></div><div class="tag"></div>
  <div class="banner frozen">Frozen: the page's timers, animations and hover are held. <button data-act="freeze">Unfreeze (${optKey('F')})</button></div>
  <div class="bar"><span class="brand">${LOGO}<b class="dotn">0</b></span>
    <button class="pinbtn" data-act="pinmode" data-key="Shortcut: ${optClick} anything on the page, no need to press Pin">Pin</button>
    <button class="bar-pins" data-act="pinlist" title="Your pins on this page and the agent's answers">Pins 0</button>
    <button class="primary" data-act="pinsend" data-key="Shortcut: ${isMac ? '⌘' : 'Ctrl+'}Return while typing a note sends everything" disabled>Send</button>
    <button data-act="freeze" data-key="Shortcut: ${optKey('F')}, without moving the mouse off what's open">Freeze</button>
    <button data-act="sizes" data-key="The page at phone, tablet and laptop sizes: pin in any of them">Sizes</button></div>`;

setRender(() => {}); // the pins draw themselves (pins.js)
// the two typefaces, declared on the page so the shadow root can use them (plain fallbacks when offline)
if (!document.getElementById('unide-fonts')) document.head?.append(Object.assign(document.createElement('link'), { id: 'unide-fonts', rel: 'stylesheet', href: FONTS }));
Object.assign(actions, { freeze: () => toggleFreeze(), sizes: () => sizes.open(), welcomed });

root.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (b && !b.disabled) actions[b.dataset.act]?.(b.dataset.arg, b, e);
});
root.addEventListener('input', (e) => { const name = e.target.dataset?.in; if (name) inputs[name]?.(e.target); });
root.addEventListener('change', (e) => { const name = e.target.dataset?.ch; if (name) changes[name]?.(e.target); });
// typing in unide's notes and fields: the page's own keyboard shortcuts never hear it
for (const t of ['keydown', 'keyup', 'keypress', 'input', 'beforeinput', 'paste', 'copy', 'cut']) root.addEventListener(t, (e) => e.stopPropagation());
