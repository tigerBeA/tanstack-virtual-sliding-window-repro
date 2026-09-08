# Performance measurements for the proposed core fix

Supporting evidence for [TanStack/virtual#1272](https://github.com/TanStack/virtual/pull/1272), recorded on 2026-09-08. The public [follow](https://tigerbea.github.io/tanstack-virtual-sliding-window-repro/) and [cache](https://tigerbea.github.io/tanstack-virtual-sliding-window-repro/cache.html) pages demonstrate the bugs using published packages; the timings below came from separate local benchmarks.

The resize microbenchmark measured an extra **12–16 microseconds per head-heavy rebuild at 10,000 rows**. The browser window-update fixture and ordinary-scroll samples did not show a consistent slowdown. These measurements cover different operations and should not be combined into an application frame-rate claim.

## Comparison versions

| Variant | Exact source                                                                                                                                    | Purpose                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Before  | Upstream [`789f5c2`](https://github.com/TanStack/virtual/tree/789f5c2c8cfdf728a37751ce4f594e3173b718df) plus [`baseline.patch`](baseline.patch) | An earlier local append-and-trim fix, without measurement-key preservation. |
| After   | PR [`e89ef7d9`](https://github.com/TanStack/virtual/tree/e89ef7d9faa280a5931734882547d6c83605aa33)                                              | The proposed combined core implementation.                                  |

**Before is not an unmodified published release.** Both versions follow the immutable-array window fixture correctly. This comparison measures the cost of preserving keys and reading previous keys without eagerly materializing rows, relative to the earlier local implementation. It does not establish the total performance impact of the PR relative to upstream main.

The before/after core source used during measurement matches these sources. In particular, the SHA-256 hashes of `packages/virtual-core/src/index.ts` are:

- Before: `ad0b1d6b2ecf10a058b3f5c63f4d0d0a355a741a3319d67fa92626d1395b4238`
- After: `22ea86e3488bc410d09764d9ef9a4c02feb3f388a9407a4363e648f38c612ef2`

## Resize cost

Node 24.8.0, macOS, production core bundles. Single lane, default numeric keys, 10,000 rows initially estimated at 30 px. Each sample performs 100 `resizeItem` + `getTotalSize` pairs at the selected index. The size changes on every iteration. Each pair of variants uses a fresh instance, alternating before/after order across 13 rounds, with GC before timing. The first three rounds are discarded; the table reports the upper middle sorted sample of the ten retained rounds.

| Dirty index | Before, 100 operations | After, 100 operations | Before per operation | After per operation |         Difference |
| ----------- | ---------------------: | --------------------: | -------------------: | ------------------: | -----------------: |
| 0           |              13.824 ms |             14.999 ms |            138.24 µs |           149.99 µs |  +11.75 µs (+8.5%) |
| 1           |              14.304 ms |             15.942 ms |            143.04 µs |           159.42 µs | +16.38 µs (+11.5%) |
| 9,999       |               0.414 ms |              0.276 ms |              4.14 µs |             2.76 µs |           −1.38 µs |

The head-heavy overhead is a measured cost: layout construction now stores keys, and partial rebuilds copy cache slots. Its absolute size in this fixture is small, but repeated work, larger lists, and slower devices can make it matter. This is not a measurement of input latency, paint, dropped frames, or streaming-message rendering.

Recorded output: [`resize-results.json`](resize-results.json). Measurement code: [`resize.mjs`](resize.mjs). The script is the original measurement loop with its two bundle paths made command-line arguments.

A publishing-time [verification run](resize-verification-results.json) using the same pinned sources and measurement loop also measured positive head-heavy overhead, with different absolute timings. The original results above are retained; the rerun is provided separately rather than replacing them with the more favorable sample.

### Retained memory

The same run measured ten instances per variant after GC, each with 100,000 caller-owned persistent string IDs. Per instance:

| Allocation  |          Before |           After |
| ----------- | --------------: | --------------: |
| JS heap     |   808,486 bytes |   809,168 bytes |
| ArrayBuffer | 1,600,000 bytes | 1,600,000 bytes |

Keys occupy the existing lazy-cache slots, and `VirtualItem` objects remain lazy. This sample does not measure transient allocation peaks or the cost of callbacks that allocate fresh key strings. The small heap difference is not evidence of an exact per-instance memory guarantee.

## Browser window updates

Chrome 152 (reported user-agent major version), macOS, visible tab, production React 19.2.8 and `@tanstack/react-virtual@3.14.11`. The core implementation is the only library variant. Rows are exactly 50 px tall, the viewport is 300 px, native CSS scroll anchoring is disabled, and callbacks capture immutable message arrays.

The timer surrounds the array update, synchronous React commit, SDK work, and forced DOM layout. It excludes paint and later animation-frame reconciliation. Each update trims one item and appends one. Every update checks the real bottom gap and latest rendered row; both variants passed. Four alternating before/after blocks use four warmups and twenty measured updates each, giving 80 retained samples per variant and size.

| Rows   | Before mean | After mean | Before median | After median | Before p95 | After p95 |
| ------ | ----------: | ---------: | ------------: | -----------: | ---------: | --------: |
| 20     |     1.26 ms |    1.17 ms |       1.30 ms |      1.30 ms |    1.70 ms |   1.60 ms |
| 1,000  |     1.36 ms |    1.20 ms |       1.40 ms |      1.20 ms |    1.70 ms |   1.60 ms |
| 10,000 |     2.75 ms |    1.30 ms |       2.80 ms |      1.40 ms |    3.40 ms |   1.70 ms |

The large-window result is consistent with avoiding eager materialization of old rows during key comparison. It should not be presented as a general application speedup, or as a speedup over the published release.

## Ordinary browser scrolling

100,000-row lists, start anchoring, append following disabled. Actual native wheel inputs moved one viewport per gesture. The timer measures the SDK offset callback, synchronous React work, and forced layout; scroll-stop callbacks and paint are excluded. Two warmup callbacks were discarded per block. Visible-row correctness was checked at the end of every block.

| Pair                            | Retained callbacks per variant | Before median | After median |
| ------------------------------- | -----------------------------: | ------------: | -----------: |
| Before → after                  |                             18 |        1.0 ms |       0.9 ms |
| After → before                  |                             18 |        0.9 ms |       1.3 ms |
| Before → after, extended sample |                             38 |        1.2 ms |       1.0 ms |

The first two pairs disagreed in direction, so the extended pair was collected and all results were retained: 74 callbacks per variant. The measurements show variability, not a consistent improvement or regression. The extended before sample contains a 19.7 ms outlier; it remains in the recorded results and is not used to claim a candidate speedup.

Recorded browser output: [`browser-results.json`](browser-results.json). It contains the per-block aggregate summaries; individual event timings were not retained. No Safari, Firefox, mobile, background-tab, dynamic-row, rich-message, or application FPS conclusion follows from this fixture.

## Re-run the resize benchmark

From this reproduction repository, with Git and Node 24.8.0 installed:

```sh
BENCH_ROOT=$(mktemp -d)
git clone https://github.com/TanStack/virtual.git "$BENCH_ROOT/virtual"
git -C "$BENCH_ROOT/virtual" fetch origin pull/1272/head
git -C "$BENCH_ROOT/virtual" worktree add --detach "$BENCH_ROOT/before" 789f5c2c8cfdf728a37751ce4f594e3173b718df
git -C "$BENCH_ROOT/virtual" worktree add --detach "$BENCH_ROOT/after" e89ef7d9faa280a5931734882547d6c83605aa33
git -C "$BENCH_ROOT/before" apply "$PWD/performance/baseline.patch"

npx --yes esbuild@0.25.12 "$BENCH_ROOT/before/packages/virtual-core/src/index.ts" --bundle --platform=node --format=esm '--define:process.env.NODE_ENV="production"' --outfile="$BENCH_ROOT/before.mjs"
npx --yes esbuild@0.25.12 "$BENCH_ROOT/after/packages/virtual-core/src/index.ts" --bundle --platform=node --format=esm '--define:process.env.NODE_ENV="production"' --outfile="$BENCH_ROOT/after.mjs"
node --expose-gc performance/resize.mjs "$BENCH_ROOT/before.mjs" "$BENCH_ROOT/after.mjs" > "$BENCH_ROOT/resize-results.json"
```

No SDK dependency install is required for those bundles. The command writes a new result file without overwriting the recorded evidence. Absolute timings and percentages vary with the machine, runtime, JIT, and concurrent load. Use the same versions and workload when comparing results.
