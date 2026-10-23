// unide overlay: click things on your HTML page, say what should change, and send the pins to your agent.
// Nothing here writes to your files: previews are one stylesheet, and the agent applies what you send.
import { mount, render } from './core.js';
import './panel.js';
import { startPins } from './pins.js';
import { startFreeze } from './freeze.js';
import { startDock } from './dock.js';
import { welcome } from './welcome.js';

if (!window.__unide) {
  window.__unide = true;
  mount();
  new MutationObserver(mount).observe(document.documentElement, { childList: true });
  render();
  startPins();
  startFreeze();
  startDock();
  welcome();
}
