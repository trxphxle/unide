// Runs at the top of <head>, before the page's own scripts (a plain script, not a module), so that:
// - ⌥-click (Alt-click) pins whatever is under the pointer, and the page never hears that click: no menu closes,
//   no link downloads, nothing activates; ⌘-click on something pinned unpins it;
// - unide's own bar and cards never count as a click outside, or take the page's focus;
// - Freeze can hold the page still: its timers and animation frames go through here, and while frozen they wait;
// - closed shadow roots, which the page's own code hides, stay reachable for ⌥-click layers.
(() => {
  if (window.__unideEarly) return;
  const W = window, native = {
    setTimeout: W.setTimeout.bind(W), setInterval: W.setInterval.bind(W), clearTimeout: W.clearTimeout.bind(W),
    requestAnimationFrame: W.requestAnimationFrame.bind(W),
  };
  const E = W.__unideEarly = { frozen: false, held: [], closed: new WeakMap(), closedHosts: [], native, onToggle: null };

  // timers: one that comes due while frozen runs after Unfreeze; an interval skips its ticks while frozen
  W.setTimeout = function (fn, ms, ...args) {
    if (typeof fn !== 'function') return native.setTimeout(fn, ms, ...args);
    return native.setTimeout(function run() { E.frozen ? E.held.push(() => fn.apply(this, args)) : fn.apply(this, args); }, ms);
  };
  W.setInterval = function (fn, ms, ...args) {
    if (typeof fn !== 'function') return native.setInterval(fn, ms, ...args);
    return native.setInterval(function tick() { if (!E.frozen) fn.apply(this, args); }, ms);
  };
  W.requestAnimationFrame = (fn) => native.requestAnimationFrame((t) => (E.frozen ? E.held.push(() => fn(performance.now())) : fn(t)));

  const attach = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init) {
    const r = attach.call(this, init);
    if (init?.mode === 'closed') { E.closed.set(this, r); E.closedHosts.push(new WeakRef(this)); }
    return r;
  };

  // while frozen the page hears nothing: no mouseleave or blur to close a menu, no click outside, no Escape.
  // unide's own controls still work (their events pass through its overlay element).
  const HUSH = ['mouseover', 'mouseout', 'mouseenter', 'mouseleave', 'mousemove', 'pointerover', 'pointerout', 'pointerenter', 'pointerleave',
    'pointermove', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'click', 'dblclick', 'auxclick', 'contextmenu', 'touchstart', 'touchmove',
    'touchend', 'focus', 'blur', 'focusin', 'focusout', 'keydown', 'keyup', 'keypress', 'input', 'change', 'wheel', 'scroll', 'resize', 'visibilitychange'];
  // A press on unide's own bar would still reach the page's "click outside closes it" listeners on the way down,
  // so those stop here too and are handed straight to unide's controls, inside its shadow root.
  const SHIELD = /^(mouse(down|up|over|out)|pointer(down|up|over|out)|click|touchstart|focus(in|out))$/;
  const REPLAY = { click: MouseEvent, pointerdown: PointerEvent, focusout: FocusEvent };
  const ours = (e) => e.composedPath().some((n) => n.tagName === 'UNIDE-OVERLAY');
  // controls whose own default does the work (typing, ticking, opening): left to the browser, never replayed
  const NATIVE = /^(INPUT|TEXTAREA|SELECT|OPTION|SUMMARY|LABEL)$/;
  // ⌥-click pins; it can be turned off for apps that use ⌥-click themselves (code editors, design tools)
  E.optOn = () => { try { return localStorage.getItem('unide:optclick') !== 'off'; } catch { return true; } };
  const OPT = /^(pointerdown|mousedown|pointerup|mouseup|click|dblclick|auxclick)$/;
  const MAC = /mac|iphone|ipad/i.test(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent);
  for (const type of HUSH) {
    W.addEventListener(type, (e) => {
      // ⌥F freezes or unfreezes without moving the pointer off what's open
      if (type === 'keydown' && e.altKey && !e.metaKey && !e.ctrlKey && e.code === 'KeyF') {
        e.preventDefault(); e.stopPropagation();
        E.onToggle?.();
        return;
      }
      if (type === 'mousemove' || type === 'pointermove') E.pointer = { x: e.clientX, y: e.clientY };
      if (e.__unide) return;
      const mine = ours(e);
      // ⌘-click (Ctrl-click off a Mac) on something you pinned: unpin it. Anywhere else ⌘-click is the page's (new tab…)
      if (!mine && OPT.test(type) && (MAC ? e.metaKey : e.ctrlKey) && !e.altKey && (e.button === 0 || e.button === undefined) && E.onUnpinHit?.(e)) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (type === 'click') E.onUnpin(e);
        return;
      }
      // ⌥-click on the page: unide's, all of it (down, up and click), so the page can't react
      if (!mine && OPT.test(type) && e.altKey && !e.metaKey && !e.ctrlKey && (e.button === 0 || e.button === undefined) && E.onOptPin && E.optOn()) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (type === 'pointerdown') E.onOptDown?.(e); // hold the page now, before a mouseleave or blur can change it
        if (type === 'click') E.onOptPin(e);
        return;
      }
      // ⌥-click that lands on a pin's card, the pins list or a badge: meant for the page underneath
      if (mine && OPT.test(type) && e.altKey && !e.metaKey && !e.ctrlKey && E.onOptPin && E.optOn() && e.composedPath().some((n) => n.classList?.contains('pop') || n.classList?.contains('plist') || n.classList?.contains('mark'))) {
        e.preventDefault(); e.stopImmediatePropagation();
        const under = document.elementsFromPoint(e.clientX, e.clientY).find((n) => n.tagName !== 'UNIDE-OVERLAY');
        if (type === 'pointerdown') E.onOptDown?.(e);
        if (type === 'click' && under) E.onOptPin({ clientX: e.clientX, clientY: e.clientY, shiftKey: e.shiftKey, target: under, composedPath: () => [under] });
        return;
      }
      if (mine) {
        // unide's own controls: the page hears nothing on the way down (no "click outside", no lost focus)
        if (!SHIELD.test(type)) return;
        e.stopPropagation();
        const t = e.composedPath()[0];
        if (type === 'mousedown' && !NATIVE.test(t?.tagName)) e.preventDefault(); // keeps the page's focus where it was
        const C = REPLAY[type];
        if (C && !(type === 'click' && (NATIVE.test(t?.tagName) || t?.closest?.('label, summary')))) {
          const copy = new C(type, { ...pick(e), bubbles: true, cancelable: true, composed: false }); copy.__unide = true; t.dispatchEvent(copy);
        }
        return;
      }
      if (!E.frozen) return;
      e.stopPropagation();
      if (/down|up|click|contextmenu|touch|key/.test(type) && e.cancelable) e.preventDefault();
    }, true);
  }

  // 3D scenes (three.js, plain or through React Three Fiber): three.js announces each renderer, scene and loader to
  // its devtools through this object. unide listens the same way: for each canvas, the scene and camera last drawn
  // to the screen, and which model file each loaded object came from. Nothing about the app changes.
  const T = E.three = { renderers: [], src: new WeakMap() };
  const tag = (data, url) => {
    const mark = (x) => { if (x && typeof x === 'object' && !T.src.has(x)) T.src.set(x, url); };
    const root = data?.scene || (data?.isObject3D ? data : null);
    if (root?.traverse) root.traverse((o) => { mark(o); mark(o.geometry); [].concat(o.material || []).forEach(mark); });
    else if (data?.isBufferGeometry) mark(data);
  };
  const observe = (x) => {
    if (!x || typeof x !== 'object') return;
    if (x.isWebGLRenderer || (x.domElement && typeof x.render === 'function' && typeof x.setSize === 'function')) {
      if (T.renderers.some((r) => r.gl === x)) return;
      const entry = { gl: x, canvas: x.domElement, pairs: [] }, render = x.render;
      T.renderers.push(entry);
      x.render = function (scene, camera) {
        // every scene drawn recently, with its camera: post-processing draws the real scene into a buffer, then a quad
        if (scene && camera) {
          const i = entry.pairs.findIndex((p) => p.scene === scene && p.camera === camera);
          const pair = i >= 0 ? entry.pairs.splice(i, 1)[0] : { scene, camera };
          pair.toScreen = !(this.getRenderTarget && this.getRenderTarget());
          entry.pairs.unshift(pair); entry.pairs.length = Math.min(entry.pairs.length, 6);
        }
        return render.apply(this, arguments);
      };
    } else if (typeof x.load === 'function' && typeof x.setPath === 'function' && !x.__unide) {
      // a loader (GLTF, OBJ, FBX…): remember the file behind what it loads
      x.__unide = true;
      const load = x.load;
      x.load = function (url, onLoad, ...rest) {
        const u = typeof url === 'string' ? (this.path || '') + url : url;
        return load.call(this, url, (data) => { try { tag(data, String(u)); } catch { /* odd result */ } return onLoad?.(data); }, ...rest);
      };
    }
  };
  if (!W.__THREE_DEVTOOLS__) W.__THREE_DEVTOOLS__ = new EventTarget();
  try { W.__THREE_DEVTOOLS__.addEventListener('observe', (ev) => observe(ev.detail)); } catch { /* someone else's object */ }

  // React: the roots it commits, so a 3D object (which has no DOM element) can be traced to the JSX that made it.
  // This is the hook React DevTools and React Refresh use; an existing one is joined, not replaced.
  E.fiberRoots = new Set();
  let H = W.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!H) {
    let id = 0;
    H = W.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { renderers: new Map(), supportsFiber: true, inject: () => ++id, checkDCE() {},
      onScheduleFiberRoot() {}, onCommitFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {} };
  }
  try {
    const commit = H.onCommitFiberRoot;
    H.onCommitFiberRoot = function (id, root) { if (root?.current) E.fiberRoots.add(root); return commit?.apply(this, arguments); };
  } catch { /* a frozen hook */ }

  const pick = (e) => ({ clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY, button: e.button, buttons: e.buttons,
    shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey, pointerId: e.pointerId, pointerType: e.pointerType, relatedTarget: e.relatedTarget, detail: e.detail });
})();
