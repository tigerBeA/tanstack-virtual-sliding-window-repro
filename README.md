# TanStack Virtual: fixed-window append loses tail follow

[Live reproduction](https://tigerbea.github.io/tanstack-virtual-sliding-window-repro/) · [Edit in StackBlitz](https://stackblitz.com/github/tigerBeA/tanstack-virtual-sliding-window-repro)

A standalone React reproduction using published `@tanstack/react-virtual@3.14.11`, `@tanstack/virtual-core@3.17.9`, and React 19.2.8. Appending a new message while trimming the oldest one keeps the count at 20, but an end-pinned viewport moves away from the bottom despite `followOnAppend: true`.

## Reproduce

1. Open the preview and confirm **Actual bottom gap: 0.00 px**.
2. Click **Append + trim oldest** once. The message IDs change from `[1…20]` to `[2…21]` in one state update.
3. Observe **Actual bottom gap: 50.00 px**. The latest message is below the viewport, although the viewport was previously at the end.
4. Click **Reset** to repeat.

Expected: the viewport stays at the end when new messages are appended, including when old messages are trimmed from the start in the same update.

## Controls

- **Ordinary append:** Reset, then click **Append only (control)**. The count grows from 20 to 21 and the bottom gap stays at 0 px.
- **Reading history:** Reset, scroll upward, then click **Append + trim oldest**. A retained message stays at the same position in the viewport; the user is not pulled to the end.
- **Return to latest:** Click **Go to latest** to call the SDK's public `scrollToEnd()` method.

## Observed DOM results

Verified on 2026-09-08 in Chrome 152 (reported user agent), macOS, using a production Vite build. The fixed-window failure repeated in three independent reset-and-click trials.

| Scenario | Count | scrollHeight | clientHeight | scrollTop | Actual bottom gap |
| --- | ---: | ---: | ---: | ---: | ---: |
| Initial, pinned | 20 | 1000 | 300 | 700 | 0 |
| Append + trim | 20 | 1000 | 300 | 650 | 50 |
| Ordinary append, after reset | 21 | 1050 | 300 | 750 | 0 |
| Reading, before append + trim | 20 | 1000 | 300 | 550 | 150 |
| Reading, after append + trim | 20 | 1000 | 300 | 500 | 200 |

The bottom gap is measured as `scrollHeight - clientHeight - scrollTop`. In the reading control, message 12 remains at 0 px relative to the viewport top before and after the update. Its changed index requires a changed `scrollTop` to preserve that position.

![After append and trim: actual bottom gap is 50px](reproduction.png)

## Fixture details

- Exactly 20 initial rows, each 50 px tall, in a 300 px viewport.
- Stable message IDs and a memoized `getItemKey` callback.
- `anchorTo: 'end'` and `followOnAppend: true`.
- Default React rendering path, exact size estimates, and no dynamic measurements.
- Native CSS scroll anchoring disabled with `overflow-anchor: none`.
- No network data, streaming, patched SDK, mocked observers, or custom scroll compensation.
- DOM diagnostics live in a separate sibling component, so their updates do not rerender the virtualized list.

The package lock pins all dependencies. On the verification date, these were the latest published React adapter and core versions. Their shipped source files (`react-virtual/src/index.tsx`, `virtual-core/src/index.ts`, and `virtual-core/src/utils.ts`) were byte-identical to upstream main at [`789f5c2`](https://github.com/TanStack/virtual/tree/789f5c2c8cfdf728a37751ce4f594e3173b718df). The browser run used the published packages, not a separate main build.

## Implementation lead

The core's [`setOptions` append-follow condition](https://github.com/TanStack/virtual/blob/789f5c2c8cfdf728a37751ce4f594e3173b718df/packages/virtual-core/src/index.ts#L624) requires `nextCount > prevCount`. This fixture changes the edge keys without increasing the count, so it takes the visible-item anchoring path rather than following the new tail.

This is a reproduction, not a proposed fix. A fix should distinguish an overlapping window moving forward from wholesale replacement, reordering, or trimming alone; changing the last key is not sufficient evidence of an append.

## Run locally

```sh
npm ci
npm run dev
```

For a production build:

```sh
npm run build
npm run preview
```

The static production build is deployed to GitHub Pages. Only synthetic numbered messages are used.
