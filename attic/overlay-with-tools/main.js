// unide overlay: click things on your HTML page, say what should change, and send the pins to your agent.
// Tools add plain-word knobs (feel, colour, palette, type, layout), lenses and snapshots.
// Nothing here writes to your files: previews are one stylesheet, and the agent applies what you send.
import { mount, render } from './core.js';
import './panel.js';
import { follow } from './draw.js';
import { loadStore } from './review.js';
import { startPins } from './pins.js';
import { startFreeze } from './freeze.js';
import { startDock } from './dock.js';

if (!window.__unide) {
  window.__unide = true;
  mount();
  new MutationObserver(mount).observe(document.documentElement, { childList: true });
  render();
  follow();
  loadStore();
  startPins();
  startFreeze();
  startDock();
}
