// Shared state and the overlay's own DOM. Every other module imports from here; this one imports nothing.

// the overlay's own timers and frames keep running while the page is frozen (early.js holds the page's)
const N = window.__unideEarly?.native;
export const setTimeout = N?.setTimeout || window.setTimeout.bind(window);
export const setInterval = N?.setInterval || window.setInterval.bind(window);
export const requestAnimationFrame = N?.requestAnimationFrame || window.requestAnimationFrame.bind(window);

export const zero = () => ({ L: 0, C: 0, H: 0 });
// everything you're trying on the current selection, until Keep
export const freshDraft = () => ({
  colour: { prop: null, steps: zero(), set: null }, feel: { e: 0, d: 0, mood: 0, play: 0 }, like: null,
  swap: null, swapType: null, variants: false, lead: null, equalize: null, state: 'rest', note: '', origin: '', hexes: [],
});
// page-wide changes: palette tokens, a type scale, fonts
export const freshPage = () => ({ tokens: {}, scale: null, fonts: null });

export const S = {
  mode: 'inspect', picking: null, sels: [], d: freshDraft(), page: freshPage(), items: [], locate: {}, pending: [],
  lens: { squint: false, gray: false, align: false, vision: 'normal', motion: 'normal' }, comparing: false,
  alignIssues: [], audit: null, openToken: null, picked: null, snapshots: [], viewing: null, refs: [], openRef: null, flash: '',
};

export const PAGE = location.pathname;
// key names as this computer shows them: ⌥ Option on a Mac, Alt elsewhere
export const isMac = /mac|iphone|ipad/i.test(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent);
export const optKey = (k) => (isMac ? `⌥${k}` : `Alt+${k}`);
export const optClick = isMac ? '⌥-click' : 'Alt+click';
// the page's switches (palette, type, theme…) at the moment you look: styles often depend on them
export const pageState = () => [document.documentElement, document.body].flatMap((e) =>
  [...e.attributes].filter((a) => a.name.startsWith('data-') || a.name === 'class').filter((a) => a.value)
    .map((a) => `${e.tagName.toLowerCase()}[${a.name}="${a.value}"]`)).join(' ');

// the overlay lives in a shadow root on <html>, so pages that rewrite <body> can't remove it
export const host = document.createElement('unide-overlay');
host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647';
export const root = host.attachShadow({ mode: 'open' });
const style = (id) => Object.assign(document.createElement('style'), { id });
export const preview = style('unide-preview');
export const lensStyle = style('unide-lens');
// nodes kept on <html>, put back if the page removes them
export const mounted = [host, preview, lensStyle];
export function mount() { for (const n of mounted) if (!n.isConnected) document.documentElement.append(n); }

export const $ = (s) => root.querySelector(s);
export const $$ = (s) => [...root.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const ours = (e) => e.composedPath().includes(host);

// panel wiring: modules register what their controls do, by name (data-act, data-in, data-ch)
export const actions = {}, inputs = {}, changes = {};
let renderFn = () => {};
export const setRender = (f) => (renderFn = f);
export const render = () => renderFn();

export const api = (path, body) => fetch('/__unide/' + path, body === undefined ? {}
  : { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }).then((r) => r.json());
