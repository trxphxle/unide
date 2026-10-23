# unide

Point at things on your pages, say (or show) what should change, and your coding agent gets it: Claude Code, Codex, Cursor, Gemini, any agent, with no copy-paste and no screenshots pasted into chat. It works on plain HTML and on apps that run on a dev server (Vite, Next.js, Nuxt, SvelteKit, Astro, Angular, React Router, Webpack/Rspack, Bun), including 3D scenes.

## Get started

You need Node 20 or newer.

1. **Install unide** (once per computer):
   ```sh
   npm install -g --allow-remote=root https://github.com/trxphxle/unide/releases/download/v0.3.0/treearc-unide-0.3.0.tgz
   ```
   That's the latest [release](https://github.com/trxphxle/unide/releases). For the newest code instead: `npm install -g --allow-git=root github:trxphxle/unide`. (npm 12 refuses packages from outside its registry unless you allow them; `root` allows only this one. Older npm ignores the flag.) Working on unide itself? `npm link` in this folder.
2. **Set up a project** (once per project):
   ```sh
   cd your-project
   unide init
   ```
   This tells your agents about unide and connects them to it (AGENTS.md and an MCP server); nothing else to configure. Restart any agent that's open; Claude Code and Cursor may ask you to approve the unide server once.
3. **Use it:** ask your agent for a link to a page (or run `unide` for one). The first time, a card by the swirl in the corner shows the gesture: **⌥-click** anything, say what should change, **Return**, then **⌘ Return** to send.

`unide remove` undoes everything `unide init` did.

Tested in Chrome (and the Chromium in Claude's app), Safari's engine (WebKit 18.5) and Firefox 137: pinning, the card, screenshots. The eyedropper in Style → Colour is Chrome's only.

## How you use it

1. Your agent gives you a link to a page (or run `unide` to get one).
2. **⌥ Option-click** anything on the page. It's pinned on the spot, the page holds still (an open menu, a dropdown or a toast stays as it was, and the page never sees the click: nothing activates, no link opens), and the note is ready.
3. Type what should change and press **Return**.
4. **⌘ Return** (or **Send** on the bar) sends your pins. Then tell your agent to go ahead.
5. The page updates by itself when the agent changes files. When the agent answers a pin, its line shows on the page. **Done is gone:** a pin the agent addressed is deleted at once with its screenshot, so `.unide/` never fills up; you judge the result on the page. A skipped pin stays, with the agent's reason, until you × it or send it again. Dismissing a pin deletes it too.

| Action | Gesture |
| --- | --- |
| Pin something | **⌥-click** it |
| See what you'd pin | hold **⌥** |
| Pin what's underneath (the word, a `::before`, what an overlay or sticky bar covers, inside a shadow root) | **⌥-click again** anywhere on the same element; ⌥-clicking something you already pinned reopens that pin |
| Add another element to the open pin | **⌥⇧-click** |
| Done with the note | **Return** (⇧ Return for a new line) |
| Throw away a pin you just made | **Esc** while its note is empty |
| Unpin something | **⌘-click** it (or its badge); hold **⌘** to see which pin. A pin with several elements loses just that one |
| Remove a pin from the list | the **×** on its row in **Pins**. The list holds still while your pointer is on it, so the next row slides up under the same ×: keep clicking to clear several |
| Send everything | **⌘ Return**, or **Send** |
| Hold the page still by hand (a timer you can't click in time) | **⌥F**, or **Freeze** |

Hovering **Pin**, **Send** or **Freeze** on the bar shows its shortcut. A new pin takes the lowest free number, so deleting pins doesn't push the count up; pins that exist keep their numbers, so an agent working on #3 always answers the right one.

unide's look is a riso print: pink and blue inks a little off register, black edges, Archivo Black and Space Mono (loaded from Google Fonts; plain fallbacks when offline). Idle, the bar is a small mark (the swirl and your pin count, pink while some aren't sent) so it covers next to nothing. It opens into the full bar while you point at it, hold **⌥**, have a pin or the Pins list open, or have Freeze on. The dot sits in a corner with nothing under it (else one with none of the page's controls) and moves if something appears there. Drag it by the swirl to put it anywhere (remembered for the site); double-click the swirl to let it choose again. The pins list and messages open on its side. The Frozen banner shows only when you press Freeze, not during the moment an ⌥-click holds the page.

While you write a pin, the rest of the page fades under a paper wash and the other badges dim, so the pinned element and its card stand out; you still see what it sits next to. The wash isn't in the agent's screenshot.

Clicking unide's own bar and cards never closes what's open on the page and never takes its focus. While **⌥** is held, unide's cards fade and let clicks through, so a ⌥-click always reaches the page. ⌘-click anywhere that isn't pinned still does what it always does (a link opens in a new tab). A native `<select>`'s open list is drawn by macOS, outside the page, so it can't be clicked: ⌥-click the closed select and pick the option you mean in the card (the pin then says "the option 'Large' in this dropdown"). **Pin** on the bar still works for a trackpad or a demo: after pressing it, a plain click pins. In apps that use ⌥-click themselves (code editors, design tools), turn ⌥-click off at the top of the Pins list.


## Apps with a dev server

If the project has a dev server (found from `package.json`), unide runs in front of it: it starts `npm run dev` (or pnpm, yarn, bun) when it isn't running, passes its hot reload through untouched, and adds the overlay to every page. Nothing in your config changes. Files outside the dev server's root (promanager's moodboards, say) are still served from disk.

Tested end to end (pin, Send, the agent reads it, an edit hot-reloads without a page reload, the answer shows on the page) on Vite + React + Tailwind, Vue, SvelteKit, Next.js, Nuxt, Astro, Angular, React Router (Remix's successor), Rspack, Webpack with Lit, and Bun.

Pins then know more:
- **The component** that drew the element and the line where it's written: React (including Next.js server components, Rspack and Bun builds), Vue and Nuxt, Svelte, Astro, Angular (the line in its template file, and where the component is defined), and Lit or other web components (where the element is defined).
- **Where its styles are written**, through the dev server: Sass and CSS Modules map back to your file and line, Svelte and Vue scoped styles too, and Tailwind classes point at the `className` line in the component.
- **They stay on the element** when a component hot-reloads or re-renders, and follow client-side route changes.

## Change it by hand

Words aren't always the quickest way. On an open pin's card, **Change it here** lets you do it on the page itself; your files aren't touched, the page shows the change at once, and the pin tells the agent exactly what to make the code do (for that element only, unless your note says otherwise):

| | |
| --- | --- |
| **Edit text** | Rewrite it in place; Return keeps it, Esc cancels |
| **Hide** | Take it off the page: the pin says to remove it |
| **Shape** | Drag the edges for size, the green bars for padding (⇧ for all sides), the yellow dot for rounder corners |
| **↑ ↓** | Move it before or after its neighbours. In a row, column or grid it moves on the page; elsewhere a pink line marks where it goes |
| **Style** | A panel beside the card, with five tabs. **Colour**: its text, background or border, with a colour wheel, a lightness slider, a hex field, the eyedropper, or the page's own tokens and colours; it says the colour in words, whether text stays readable, and the nearest token (the agent is told to use it). **Font**: the page's fonts, then 67 trending free fonts, or search; point to preview, click to keep; fonts on your Mac say so, others have **Get ↗**. **Text**: size from the page's own type scale, weight, line height, letter spacing, capitals, alignment. **States**: show it hovered, pressed, focused or disabled without doing it; what you change then is for that state only. **Copy look**: ⌥-click another element to take its colours, border, corners, type, padding and shadow |
| **Image** | On images only: drop a file, choose one, or paste a link; set how it fits (cover · contain · fill · none) and click its focal point. A dropped file waits in `.unide/assets/` for the agent and goes when the pin is done |
| **Icon** | On icons only: swap it for one of Lucide's free icons (search by name or meaning); point to preview it in place, in the icon's own colour; click to keep |

**⌘Z** undoes the last change, **Reset** clears them. The changes stay on the page until the agent answers the pin; then the page shows the real thing. A pin with changes and no note is still a clear request.

## Three options instead of one

Turn on **3 options** on a pin before you send it. The agent builds three versions in the code, marked so unide can flip between them, and answers "options ready". Open the pin: **A · B · C** switch the live page between them; **Keep B** sends your choice back, and the agent keeps that one and removes the others.

## Before and after

When the agent finishes a pin, a card by the bar says so, with **Compare**: your screenshot from when you pinned it against the same area now (a wipe, side by side, or one at a time). The pin itself is already gone; the before picture lives only in that page's memory until you leave.

## Sizes

**Sizes** on the bar shows the page at phone, tablet and laptop sizes side by side, each live: ⌥-click in any of them to pin there. Every pin records the window it was made in, and the agent hears when that was a small screen.

## 3D scenes (three.js and React Three Fiber)

⌥-click an object in a 3D canvas and the pin is that object, not the canvas: its name and the named groups it sits in, the model file it came from (`/models/…/mount_fuji.glb`), its material, size and position, the point you clicked, and the component that drew it with file:line. A nameless mesh counts as part of the named thing it belongs to (the mountain, not one of its meshes); ⌥-click again goes to what's behind it. While ⌥ is held, the object under the pointer is outlined by its own shape, and the open pin's object is outlined the same way (also in the agent's screenshot). The badge sits on the spot you clicked and follows it as the camera moves; ⌘-click unpins only the object under the pointer.

unide hears about renderers, scenes and loaders the way three.js's own devtools do, so nothing in the app changes. Objects the app made unclickable for its own pointer events can still be pinned. A mesh that merges many things (a whole street baked into one) is one object; the clicked point says where on it. Not covered yet: WebGPU renderers, Babylon.js, PlayCanvas.

## What `unide init` does

- `.unide/`: your pins, and what it found (pages, templates, build scripts).
- **Instructions** in `AGENTS.md` (Codex, Cursor, Copilot and others), `CLAUDE.md` and `GEMINI.md`, between `<!-- unide:start -->` and `<!-- unide:end -->`.
- **The MCP server** registered with Claude Code (private to you), Cursor, VS Code and Gemini CLI when they're on your Mac or in the project. Codex keeps servers in `~/.codex/config.toml`, so init asks first (or `unide init --codex`). The agent starts unide by itself, on a port that's always the same for this project.
- `.gitignore`: `.unide/` and the machine-specific config files it created.

It lists every change. `unide remove` undoes all of them and restores your files as they were.

## What the agent gets

MCP tools: `get_pins` (your open pins: the element, measurements, where its style is written as file:line, page state, your words, and a screenshot of the area with the pinned part outlined: its path under `.unide/shots/`, and the image itself), `resolve_pin` (addressed or skipped, with one line for you), `page_link`, `list_pages`. Agents without MCP read `.unide/pins.md` (with the screenshot paths) and answer in `.unide/replies.md` (`#3 addressed: …`).

Screenshots are drawn from the page itself when you pin (no permission prompt, never the unide bar), so they show what was open or frozen at that moment. They can't show what the page can't draw: a native select's option list, or a frame from another origin. Screenshots no pin refers to any more are deleted when unide starts.

## Commands

`unide init` · `unide` (start it here and print the link) · `unide remove` · `unide mcp` (started by your agent tools)

Installed from a GitHub release (see Get started) or with `npm link` in this folder. Requires Node 20 or later.

## Code

`bin/unide.mjs` (commands) · `lib/server.mjs` (static pages or the dev-server proxy, pins API, live reload) · `lib/devserver.mjs` (finding and starting dev servers) · `lib/routes.mjs` (framework routes) · `lib/pins.mjs` · `lib/mcp.mjs` (stdio MCP) · `lib/init.mjs` (init and remove) · `lib/locate.mjs` and `lib/sourcemap.mjs` (where code and styles are written) · `overlay/` (the page overlay, ES modules: `pins.js` is the default view, `components.js` and `stylesource.js` read components and style sources, `shot.js` takes the screenshots with the vendored `snapdom.js` (MIT), `freeze.js` and `early.js` (a plain script at the top of `<head>`, before the page's own) hold the page still, `layers.js` finds what's under the pointer, `edits.js` is Change it here, `three.js` finds 3D objects in three.js canvases, `dock.js` places the bar, `styles.js` is the look). The retired Tools panel is in the first commit of this repository. `fixtures/hard-ui/` is a Vite + React app of cases that are hard to pin, with `RESULTS.md`: what unide does on each.

## Licence

MIT: see [LICENSE](LICENSE). `overlay/snapdom.js` is snapDOM, also MIT ([its licence](overlay/snapdom.LICENSE)).
