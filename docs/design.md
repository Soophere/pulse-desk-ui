# Design notes

The desk is operated in short, interrupted sessions — a glance at the phone on the train, then back
to work. The UI is designed for that, not for screenshots.

## Principles

1. **Honest numbers first.** Paper and live money are never mixed. A paper result is labelled
   `paper` everywhere it appears; live figures are only ever from live endpoints. Period buttons
   recompute from the same payload the page was rendered from, so a number cannot "drift" from the
   total.
2. **One page per money method.** Core bot, Wish Me Rich, Moonshot, On-chain Alpha and Follows each
   have their own page with their own status, slots, controls and counts. The Home page is an index,
   not a summary that hides detail.
3. **The operator is the safety layer.** Destructive or money-moving actions (flatten, sell all,
   reset data, live start) are separated from navigation, always described in plain words, and
   confirmed. Writes need the dashboard token; reads do not.
4. **A silent failure must look like a failure.** Status dots are driven by the same poll as the
   pages, "connecting" is visible, and the UI says when it is offline instead of showing a stale
   screen.
5. **No build step.** One HTML shell, one stylesheet of custom properties, two JS modules. The whole
   UI can be shipped with `scp` and swapped during operation without a restart.

## Visual language

- Flat source-list sidebar, grouped page background, solid cards — no blur, glass, floating cards or
  drop shadows.
- One accent colour (`#3880f0`) for actions and selection, ink `#1f1f1f` for text, danger
  `#e11d48`, warning `#ff9500`. Everything else is a neutral.
- Numbers are set in a mono face with tabular figures so columns do not jump while prices move.
- Icons are minimal inline SVG strokes; the visual weight stays on the data.
- Charts are canvas: candlesticks with volume, sparklines per row, and the method's own signal
  overlaid — no chart library.

## Information architecture

| Group | Pages |
|---|---|
| Overview | Home, Testing (paper) |
| Methods | Core bot, Wish Me Rich, Moonshot, On-chain Alpha, Follows |
| Tools | AI council, Exchanges, Strategies, Rules, Settings |

On the phone the sidebar collapses; the same page ids and renderers are reused, so there is exactly
one implementation of each screen.

## Test harness

Every page renderer is exercised in Node against a payload captured from the live desk. The harness
builds a minimal DOM stub, renders each page, and asserts on the produced HTML. It earns its keep:
it caught a crash on the Core and Activity pages (`clock is not defined`), an invalid CSS selector
in an inline handler, and a chart poll that kept running after its modal closed.
