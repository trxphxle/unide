# unide on hard UI: results

What unide does on each case in this fixture, before and after the three fixes (screenshots, Freeze, ⌥ Option-click layers).

**How it was measured.** unide in front of this app's Vite dev server (`node serve.mjs fixtures/hard-ui`), driven in Chromium with a real mouse and keyboard (Playwright), plus `public/measure.js`, which pins through the overlay's own module what a click at that spot would hit. "What the agent gets" is the text of `get_pins` read over the MCP server, and since the fixes the screenshot it returns. Run on 2026-10-22, React 19, Vite 7, window 1100×800.

**Columns**
- **Pin it?** Can a person pin the thing they mean (not its container, not what covers it)?
- **Comes back?** Does the badge find that same thing after a reload, a hot reload, or the page re-rendering?
- **file:line** Is the component line (and the style line) the right place to edit?
- **Agent gets it?** Can the agent tell what's wrong from what it receives: the cause in code, or at least the problem in the screenshot?

✅ yes · ⚠️ partly / with a catch · ❌ no · — doesn't apply

## The three fixes

1. **Screenshot on every pin.** The moment you pin, the overlay draws the area around the target from the page's DOM (snapDOM, vendored as `overlay/snapdom.js`), with the target outlined, and saves it to `.unide/shots/`. `get_pins` and `pins.md` give its absolute path; `get_pins` also returns the image itself. No permission prompt, and unide's own bar is never in it. Things fixed or stuck to the screen (toasts, modals, sticky bars) are drawn where they are on screen, so a menu under a sticky bar shows the bar over it.
2. **Freeze** (bar button, or **⌥ Option + F** without moving the mouse). The page's timers wait, intervals skip, animation frames, CSS animations, transitions and media pause, the page hears no pointer, focus, key or scroll events (so nothing closes on mouseleave, blur, Escape or a click outside), and hover/focus styles stay on what had them. Pins made while frozen say so. Unfreeze runs what was held and tells the page the pointer and focus moved on.
3. **⌥ Option-click layers.** While pinning, ⌥ Option-click pins what's under the top element: the word under the pointer, the top element's `::before`/`::after`, then what's painted beneath (through transparent overlays, sticky bars, and into open *and* closed shadow roots). ⌥ Option-click again on the same spot goes one layer further. The card lists the layers and marks the chosen one; click another to switch. Holding ⌥ Option while pinning previews it. Plain clicks inside an open shadow root now pin the element itself, not its host.

Small fixes found while measuring: a badge for an element that isn't shown (display:none at this width, a closed menu) was drawn in the page's top-left corner; it's hidden now. Port 4190, one of the ports `preferredPort` can choose, is on the Fetch standard's blocked list, so Node's `fetch` (the MCP bridge) refused to talk to it; unide skips it now.

## Before → after

### Vanishing UI

| Case | Pin it? | Comes back? | file:line | Agent gets it? |
|---|---|---|---|---|
| **V1** Hover menu opened by JS | ⚠️ → ✅ Before: only if Pin was pressed *before* hovering; pressing Pin with the menu open closes it. After: ⌥ Option + F while hovering, then Pin, then click the item. | ❌ → ⚠️ Closes as soon as you move to the note. After: stays while frozen; afterwards the badge hides with the menu (the screenshot keeps it). | ✅ Vanishing.jsx:14, `.hover-menu a` styles.css:21 | ❌ → ✅ Screenshot of the open menu, "pinned while frozen: it may only exist while open" |
| **V2** Tooltip (CSS :hover) | ❌ → ✅ Before: moving from the button to the tooltip drops :hover; the click landed on the case's caption. After: ⌥ Option + F on the button keeps the tooltip. | — → ⚠️ as V1 | — → ✅ Vanishing.jsx:54, `.tip-wrap .tip` styles.css:24 | ❌ → ✅ screenshot shows the tooltip |
| **V3** Toast that auto-dismisses (2.5s) | ⚠️ → ✅ Before: a race (pressing Pin and clicking within 2.5s worked at 1.4s). After: Freeze holds its timer; still there at 3.7s. | ❌ → ⚠️ as V1 | ✅ Vanishing.jsx:33, `.toast` styles.css:26 | ⚠️ → ✅ screenshot, drawn where it sits on screen |
| **V4** Dropdown that closes on blur | ❌ → ✅ Before: pressing Pin blurs the field and the list closes (4 options → 0). After: ⌥ Option + F with the field focused; the list stays through Pin and the click; closes on Unfreeze. | — → ⚠️ as V1 | — → ✅ Vanishing.jsx:44, `.combo li` styles.css:32 | ❌ → ✅ screenshot |

### Non-elements

| Case | Pin it? | Comes back? | file:line | Agent gets it? |
|---|---|---|---|---|
| **N1** Native select popup | ⚠️ → ✅ the list itself can't be clicked (drawn by the OS), but the card lists the select's options and the pin records the one picked | ✅ | ✅ NonElements.jsx:7 | ⚠️ → ✅ the screenshot shows the closed select, and the pin says which option and why the screenshot can't show it |
| **N2** `::before` / `::after` | ❌ → ✅ Before: the whole span. After: ⌥ Option-click on the star gives `::before`, again `::after`. (unide can't measure a pseudo-element's box, so both are offered anywhere on the element.) | ✅ → ✅ after reload and hot reload | ❌ → ✅ Before: "styled by utility class `price`, written in its className" (wrong: it's a stylesheet rule). After: `.price::before` at styles.css:36, its content and colours | ❌ → ✅ |
| **N3** One word in a paragraph | ❌ → ✅ Before: the whole paragraph. After: ⌥ Option-click gives "the word “quarterly” (in “…Switch to quarterly billing…”)" | — → ✅ badge on the word after reload and hot reload | ✅ the paragraph's line | ⚠️ → ✅ |

### Walls

| Case | Pin it? | Comes back? | file:line | Agent gets it? |
|---|---|---|---|---|
| **W1** Open shadow DOM | ❌ → ✅ Before: the click is retargeted to the host `<open-card>`. After: a plain click pins the button inside. | ✅ → ✅ (path through the shadow root) | ⚠️ → ✅ Before: the host's line only, no styles. After: "inside the open shadow root of <open-card>; <open-card> is used by <Walls> at Walls.jsx:38; styled by `.c button` at Walls.jsx:13" | ❌ → ✅ |
| **W2** Closed shadow DOM | ❌ → ✅ Before: host only. After: ⌥ Option-click reaches inside (unide keeps closed roots from page load). | ✅ | ⚠️ the host's line (the inside's style isn't traced) | ❌ → ✅ screenshot shows the inside too |
| **W3** Same-origin iframe | ⚠️ unchanged: the page pins the `<iframe>`; the frame gets its **own second unide bar**, which covers most of a small frame; pins made there belong to /frame.html | ✅ | ✅ Walls.jsx:40 | ⚠️ → ✅ screenshot renders the frame's content (without its bar) |
| **W4** Cross-origin iframe | ⚠️ unchanged: the `<iframe>` only; nothing inside is reachable | ✅ | ✅ Walls.jsx:41 | ❌ unchanged: the screenshot can't draw another origin's frame either |
| **W5** Canvas chart | ⚠️ unchanged: the whole canvas; "the red bar" only in words | ✅ | ✅ Walls.jsx:30 | ❌ → ✅ screenshot shows the bars |
| **W6** Inline SVG icon | ⚠️ unchanged: the svg, or one path when the click lands on its thin stroke | ✅ | ✅ Walls.jsx:45 | ⚠️ → ✅ screenshot shows the clapper |

### Wrong layer

| Case | Pin it? | Comes back? | file:line | Agent gets it? |
|---|---|---|---|---|
| **L1** Transparent overlay above a button | ❌ → ✅ Before: the invisible `div.cover`. After: ⌥ Option-click pins the button; the card shows "Layer 2 of 2". | ✅ | ❌ → ✅ Before: called `cover` a utility class (it's in styles.css). After: the button at WrongLayer.jsx:42 | ❌ → ✅ "layer 2 of 2, beneath `div.cover` (on top: that takes the clicks)": the cause |
| **L2** Portal-rendered modal | ✅ | ⚠️ only while the modal is open (unchanged) | ✅ WrongLayer.jsx:15, the component that renders the portal | ⚠️ → ✅ screenshot with the backdrop |
| **L3** Portal-rendered dropdown | ✅ | ⚠️ only while open (unchanged) | ✅ WrongLayer.jsx:31 | ⚠️ → ✅ |

### Identity

| Case | Pin it? | Comes back? | file:line | Agent gets it? |
|---|---|---|---|---|
| **I1** Virtualized list | ✅ | ❌ unchanged: after scrolling, the badge moves to **another row** (“Order #1022”): react-window reuses the DOM node | ✅ Identity.jsx:5 | ⚠️ → ✅ screenshot shows which row was meant |
| **I2** List that re-sorts every 3s | ✅ (Freeze also holds the shuffle) | ✅ found again by its text | ✅ Identity.jsx:13 | ✅ |
| **I3** Live-updating text | ✅ (Freeze holds it still) | ✅ by its path, though its text changed | ✅ Identity.jsx:19 | ✅ |
| **I4** Only exists below 600px | ⚠️ only at that width (unchanged; resize the window) | ❌ → ✅ Before: at a wider window its badge sat in the page's top-left corner. After: hidden until the element shows again. | ✅ Identity.jsx:31, `.mobile-only` styles.css:57 | ⚠️ → ✅ screenshot at the narrow width |

### Wrong cause

| Case | Pin it? | Comes back? | file:line | Agent gets it? |
|---|---|---|---|---|
| **C1** Gap comes from the parent | ✅ | ✅ | ✅ the child's line | ❌ → ⚠️ the screenshot shows the 40px space; the text still doesn't say the parent's `gap` makes it |
| **C2** Component library default (Pico) | ✅ | ✅ | ⚠️ unchanged: `.pico button` at node_modules/@picocss/pico/css/pico.conditional.min.css:4, a minified line in node_modules; nothing says "override it in your CSS" | ⚠️ unchanged |
| **C3** CSS-in-JS runtime class (Emotion) | ✅ | ✅ | ❌ unchanged: "drawn by <Styled(span)>", no file; calls `css-1t1zqvt` a utility class | ❌ → ⚠️ the screenshot shows the pill; the styled call's line is still missing |
| **C4** clsx conditional classes | ✅ (Freeze holds the flip) | ✅ | ✅ WrongCause.jsx:22 | ⚠️ unchanged: the classes of that moment, not that they're conditional |
| **C5** 3-step CSS variable chain | ✅ | ✅ | ⚠️ unchanged: `.cta` at styles.css:63; the chain `--cta-bg → --accent → --brand-violet` (tokens.css:4) isn't followed | ⚠️ unchanged |

### Perception

| Case | Pin it? | Comes back? | file:line | Agent gets it? |
|---|---|---|---|---|
| **P1** Icon with padding inside its viewBox | ✅ | ✅ | ✅ | ❌ → ✅ the facts say 20×20; the screenshot shows the glyph is half that |
| **P2** Text on a gradient / photo | ✅ | ✅ | ✅ | ❌ → ✅ the facts said "no background, text very light grey"; the screenshot shows white on pale |
| **P3** Layout shift on image load | ✅ | ✅ | ✅ | ❌ unchanged: the screenshot is after the shift; nothing says the image has no size |
| **P4** Long unbreakable text | ✅ | ✅ | ✅ | ⚠️ → ✅ screenshot (in this Chromium the URL wraps instead of overflowing, so the case is milder than intended) |
| **P5** Dropdown under the sticky header | ❌ → ✅ Before: a click on the hidden part lands on the header. After: ⌥ Option-click on the header reaches the hidden item. | ✅ | ✅ Perception.jsx:36 | ❌ → ✅ "beneath `header.sticky-top`", and the screenshot draws the bar over the menu |

## Count

| | Before | After |
|---|---|---|
| Pin it ✅ | 14 of 30 | 25 of 30 (⚠️ left: W3 and W4 frames, W5's bar inside a canvas, W6's thin strokes, I4 only at its width) |
| Agent gets it ✅ | 2 of 30 | 23 of 30 (⚠️ 5: C1–C5 · ❌ 2: W4, P3) |
| Wrong file:line or a wrong "utility class" claim | 3 (N2, L1, C3), C2 partly | 1 (C3), C2 partly |

## End to end

Pinned the frozen hover menu's item (V1) and the covered button (L1, ⌥ Option-click), typed notes, pressed **Send**, then called the MCP server over stdio as an agent would: `get_pins` returned both pins with "Screenshot of the area as they saw it: /…/.unide/shots/94-1-….png" (both files exist) and both images inline; `resolve_pin` marked them addressed, and the page showed the green badge and "Your agent answered #95".

## Still open (not fixed here)

- **I1** virtualized rows: pins follow the reused DOM node to the wrong row. Needs an identity beyond path and text (the framework's key).
- **W3** same-origin frames get their own unide bar over the frame's content; the page's overlay should reach into the frame instead.
- **C1, C3, C5, C2, P3** causes not in the text: the parent's gap, the Emotion `styled` call's line, the variable chain to its value, "a library default: override it", an image without dimensions.
- An element whose rules set only properties unide doesn't track (position, inset…) is called a "utility class" (`div.cover` before the fix; `.after-img` on P3).
- N1's OS-drawn option list can't be clicked or drawn; its options are picked from the card instead. W4's cross-origin frame can't be pinned or drawn from the page at all.
