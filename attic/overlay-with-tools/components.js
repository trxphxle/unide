// Which component drew an element, and where that code is written. Read from each framework's development
// build: React (fibers and their debug stacks), Vue 3, Svelte, Angular, and custom elements (Lit and others).
// Production builds don't carry this, so the answer is null there and pins fall back to the page position.
import { mapFor, original, cleanSource } from './sourcemap.js';
import { api } from './core.js';

const base = (f) => (f || '').split('/').pop().replace(/\.[a-z]+$/i, '');
const fiberOf = (el) => { for (const k in el) if (k.startsWith('__reactFiber$')) return el[k]; return null; };
const compName = (t) => (t && (t.displayName || t.name || t.render?.displayName || t.render?.name || t.type?.displayName || t.type?.name)) || null;
const isComponent = (f) => typeof f.type === 'function' || (f.type && typeof f.type === 'object' && (f.type.render || f.type.type));

// React: the owner component, and the line where this element's JSX is written
async function react(el) {
  let f = null;
  for (let e = el; e && !f; e = e.parentElement) f = fiberOf(e);
  return f ? fromFiber(f) : null;
}
// from any fiber, also one that isn't a DOM element (a 3D object drawn by React Three Fiber)
export async function fromFiber(f) {
  let owner = f._debugOwner;
  while (owner && !isComponent(owner)) owner = owner._debugOwner || owner.return;
  if (!owner) { owner = f.return; while (owner && !isComponent(owner)) owner = owner.return; }
  let name = owner ? compName(owner.type) : null;
  const internal = (n) => !n || /^(Fragment|Suspense|ErrorBoundary|InnerLayoutRouter|OuterLayoutRouter|LayoutRouter|RenderFromTemplateContext|ScrollAndFocusHandler|Router|AppRouter|ClientPageRoot|ClientSegmentRoot|SegmentViewNode|SegmentViewStateNode|HTTPAccessFallbackBoundary|RedirectBoundary|NotFoundBoundary|LoadingBoundary|MetadataBoundary|ViewportBoundary|OutletBoundary|HotReload|DevRootHTTPAccessFallbackBoundary|AppDevOverlay|ReactDevOverlay|Root|ServerRoot|fakeJSXCallSite)$/.test(n);
  if (internal(name)) name = null;
  // React 18 with the JSX source transform
  if (f._debugSource?.fileName) return { framework: 'React', name, file: cleanSource(f._debugSource.fileName), line: f._debugSource.lineNumber };
  // React 19: where the JSX was created, from its stack, mapped back through the module's source map
  const stack = f._debugStack?.stack || '';
  for (const m of stack.matchAll(/at (?:([\w$.<>]+) \()?(?:about:\/\/React\/\w+\/)?((?:https?|webpack-internal|file):\/\/[^\s)]+?):(\d+):(\d+)\)?$/gm)) {
    const [, fn, url, line, col] = m;
    // a server component's frame points at its compiled file on disk; the server maps it back
    if (url.startsWith('file://')) {
      const file = decodeURIComponent(url.slice(7)).split('?')[0];
      if (/node_modules/.test(file) && !/\.next\/|\.output\/|\.svelte-kit\//.test(file)) continue;
      const o = await api(`mapfile?path=${encodeURIComponent(file)}&line=${line}&col=${col}`).catch(() => null);
      if (o?.file) return { framework: 'React', name: name || (internal(fn) ? null : fn), file: o.file, line: o.line, server: true };
      continue;
    }
    if (/node_modules|\/@react-refresh|\/\.vite\/deps\/|react-dom|react-jsx|\/_next\/static\/chunks\/(?:node_modules|.*react)/.test(url) && !/\/(app|src|pages|components)\//.test(url)) continue;
    if (url.startsWith('webpack-internal:')) return { framework: 'React', name, file: cleanSource(url.replace(/^webpack-internal:\/\/\/(\([^)]*\)\/)?/, '')), line: null };
    const map = await mapFor(url);
    const o = map && original(map, +line, +col);
    if (o && !/node_modules/.test(o.file)) {
      // bundlers rename clashing functions (Bun: Badge → Badge2); the file's own name is what you wrote
      let n = name || (internal(fn) ? null : fn);
      const m = n?.match(/^(.+?)\d+$/);
      if (m && base(o.file) === m[1]) n = m[1];
      return { framework: 'React', name: n, file: o.file, line: o.line };
    }
  }
  return name ? { framework: 'React', name, file: null, line: null } : null;
}

// Vue 3: the component instance and its file (Vite and Nuxt set __file in development)
function vue(el) {
  for (let e = el; e; e = e.parentElement) {
    const inst = e.__vueParentComponent;
    if (!inst) continue;
    const t = inst.type || {};
    const file = t.__file ? cleanSource(t.__file) : null;
    return { framework: 'Vue', name: t.__name || t.name || base(file) || null, file, line: null };
  }
  return null;
}

// Svelte: development builds record each element's file, line and column
function svelte(el) {
  for (let e = el; e; e = e.parentElement) {
    const loc = e.__svelte_meta?.loc;
    if (loc?.file) return { framework: 'Svelte', name: base(loc.file), file: cleanSource(loc.file), line: loc.line + (loc.line === 0 ? 1 : 0) };
  }
  return null;
}

// Astro: older versions mark elements with data-astro-source-file; scoped styles mark them with data-astro-cid-*,
// and the dev server names the component's file on the <style> that uses that id; otherwise it's the page's file
const isAstro = () => !!document.querySelector('astro-dev-toolbar, script[src*="astro"], meta[name="generator"][content^="Astro"]');
async function astro(el) {
  for (let e = el; e; e = e.parentElement) {
    const file = e.getAttribute?.('data-astro-source-file');
    if (file) return { framework: 'Astro', name: base(file), file: cleanSource(file), line: +(e.getAttribute('data-astro-source-loc') || '').split(':')[0] || null };
    const cid = e.getAttributeNames?.().find((a) => a.startsWith('data-astro-cid-'));
    if (cid) {
      const style = [...document.querySelectorAll('style[data-vite-dev-id]')].find((s) => s.textContent.includes(cid));
      const f = style?.dataset.viteDevId?.split('?')[0];
      if (f) return { framework: 'Astro', name: base(f), file: cleanSource(f), line: null };
    }
  }
  if (!isAstro()) return null;
  const pages = await api('pages').catch(() => []);
  const page = pages.find((p) => p.route === location.pathname.replace(/\/$/, '') || (p.route === '/' && location.pathname === '/'));
  return page?.file ? { framework: 'Astro', name: base(page.file), file: page.file, line: null } : null;
}

// where a component is defined, found by what the source must say: selector: 'app-x', customElements.define('x-y'
const defined = async (needles) => api('grep?' + needles.map((n) => 'q=' + encodeURIComponent(n)).join('&')).catch(() => null);

// Angular in development mode exposes ng.getOwningComponent; the component's selector leads to its file
async function angular(el) {
  const ng = window.ng;
  if (!ng?.getOwningComponent) return null;
  let c;
  try { c = ng.getComponent?.(el) || ng.getOwningComponent(el); } catch { return null; }
  if (!c) return null;
  const ctor = c.constructor, sel = ctor?.ɵcmp?.selectors?.[0]?.[0];
  const hit = sel ? await defined([`selector: '${sel}'`, `selector: "${sel}"`, `selector:'${sel}'`, `selector:"${sel}"`]) : null;
  // with templateUrl the element is written in the template file; pins.js finds its line there
  const tpl = hit?.file ? await api('ngtemplate?file=' + encodeURIComponent(hit.file)).catch(() => null) : null;
  return { framework: 'Angular', name: ctor?.name?.replace(/^_+/, '') || sel || null, file: tpl?.file || hit?.file || null, line: tpl ? null : hit?.line || null, definedAt: hit ? `${hit.file}:${hit.line}` : null };
}

// custom elements (Lit, Stencil, plain web components): the nearest one is the component, found by where its tag is defined
async function customElement(el) {
  for (let e = el; e; e = e.parentElement || e.getRootNode()?.host) {
    const tag = e.tagName?.toLowerCase();
    if (!tag?.includes('-') || !customElements.get(tag)) continue;
    const hit = await defined([`customElements.define('${tag}'`, `customElements.define("${tag}"`, `@customElement('${tag}')`, `@customElement("${tag}")`, `tag: '${tag}'`, `tag: "${tag}"`]);
    return { framework: 'Web component', name: `<${tag}>`, className: customElements.get(tag)?.name || null, file: hit?.file || null, line: hit?.line || null };
  }
  return null;
}

export async function componentOf(el) {
  try { return (await react(el)) || vue(el) || svelte(el) || (await astro(el)) || (await angular(el)) || (await customElement(el)); } catch { return null; }
}
