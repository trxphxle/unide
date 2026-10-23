You are helping design **unide**, a tool that lets a person point at things on their web pages and tell any AI coding agent what should change, with no copy-paste and no screenshots pasted into chat.

## The problem it solves
People who build UI with coding agents (Claude Code, Codex, Cursor, Gemini) struggle to say *which* thing they mean and *what* is wrong with it. They lack design vocabulary ("it feels off"), the agent can't see the page, and describing a button in words loses information. unide closes that gap: the person clicks the thing, says what should change, and the agent receives an exact, machine-readable description of it.

## How it works today
- **Lives in the project.** `unide init` once per project: it adds instructions to AGENTS.md (and CLAUDE.md / GEMINI.md), registers an MCP server for Claude Code, Codex, Cursor and Gemini, and keeps its data in `.unide/`. `unide remove` undoes everything.
- **Works on any page.** Plain HTML files are served directly; apps behind a dev server (Vite, Next, Nuxt, SvelteKit, Astro, Angular, React Router, Rspack, Webpack, Bun) are proxied, with hot reload intact. An overlay is injected in a shadow DOM, so it never affects the page's styles.
- **Pinning (macOS gestures).** ⌥-click anything to pin it; the page holds still while you type a note, so open menus, dropdowns and toasts stay open and the page never receives the click. ⌥-click again goes a layer deeper (a word, a ::before, what's under an overlay). ⌥⇧-click adds another element to the same pin. Return finishes the note; ⌘Return sends everything; ⌘-click unpins; ⌥F freezes the whole page.
- **Hard UI is covered:** closed shadow DOM, native dropdown options (picked from the pin card), click-through layers, and 3D objects in three.js / React Three Fiber scenes (outlined by their own shape).
- **What the agent receives** (via MCP `get_pins`, or `.unide/pins.md`): the user's words; each element's identity, measurements, page state; the component that drew it with file:line (React, Vue, Svelte, Astro, Angular, web components) and where its styles are written (through source maps); for 3D, the object's name, model file, material and size; and a screenshot with the pinned part outlined. Pins not yet sent are included, marked "not sent yet".
- **Closing the loop.** The agent answers each pin with `resolve_pin` ("addressed" + one line, or "skipped" + why). The user sees the answer on the page. Addressed pins are deleted at once with their screenshots; skipped ones stay with the reason. The user judges the result on the page.
- **The bar** is a small dot ("u" + pin count) that opens into a bar when pointed at or in use, avoids the page's own controls, and can be dragged anywhere.
- **Tools panel (older, under review):** Inspect (states, "feel" knobs, "make it like that one", where a style lives), Colour (names, palette tokens, near-duplicate check), Type (scale, fonts, near-duplicate sizes), Layout (hierarchy, spacing, near-miss alignment), Review (squint/gray/colour-vision/motion lenses, snapshots, references, a request to the agent).

## Principles
- The user is competent and works fast; gestures beat modes and panels.
- People edit a draft more readily than they author from a blank page.
- Facts come from the live page; intent comes from the user's words. Never guess silently: mark guesses.
- Nothing unide does writes to the user's source files; only the agent changes code.
- Use macOS key names (⌥ Option, ⌘ Command, ⇧ Shift, Return).
- Keep storage small: done is gone.

## Open question
The Tools panel should be rethought. Candidate directions: direction chips on a pin (bolder, calmer, more space, tighter…), "show me 3 options" (the agent renders variants the user flips between on the live page), trying a change live before asking, "like that one" (copy another element's look), before/after for answered pins, a page check whose findings become pins, viewing the page at several screen sizes, and showing all of a component's states at once. Judge each by whether a fast, competent user would actually reach for it mid-flow instead of just typing a note.
