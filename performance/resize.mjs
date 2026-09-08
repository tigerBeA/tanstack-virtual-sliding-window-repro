import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

if (process.argv.length !== 4 || !global.gc) {
  throw new Error(
    "Usage: node --expose-gc performance/resize.mjs BEFORE.mjs AFTER.mjs",
  );
}

const { Virtualizer: Before } = await import(
  pathToFileURL(resolve(process.argv[2]))
);
const { Virtualizer: After } = await import(
  pathToFileURL(resolve(process.argv[3]))
);

function create(Virtualizer, count, getItemKey) {
  const instance = new Virtualizer({
    count,
    estimateSize: () => 30,
    getItemKey,
    getScrollElement: () => null,
    scrollToFn: () => {},
    observeElementRect: () => {},
    observeElementOffset: () => {},
  });
  instance.getTotalSize();
  return instance;
}

const median = (values) => values.sort((a, b) => a - b)[values.length >> 1];
const results = [];
for (const index of [0, 1, 9999]) {
  const samples = { before: [], after: [] };
  for (let round = 0; round < 13; round++) {
    const variants =
      round % 2
        ? [
            ["after", After],
            ["before", Before],
          ]
        : [
            ["before", Before],
            ["after", After],
          ];
    for (const [label, Virtualizer] of variants) {
      const instance = create(Virtualizer, 10000);
      global.gc();
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        instance.resizeItem(index, 31 + (i % 5));
        instance.getTotalSize();
      }
      if (round >= 3) samples[label].push(performance.now() - start);
    }
  }
  const before = median(samples.before);
  const after = median(samples.after);
  results.push({
    index,
    beforeMs: before,
    afterMs: after,
    ratio: after / before,
  });
}

// Both variants use the same caller-owned IDs; include backing arrays in the total.
const ids = Array.from({ length: 100000 }, (_, i) => `id-${i}`);
const memory = {};
for (const [label, Virtualizer] of [
  ["before", Before],
  ["after", After],
]) {
  global.gc();
  const baseline = process.memoryUsage();
  const instances = Array.from({ length: 10 }, () =>
    create(Virtualizer, ids.length, (i) => ids[i]),
  );
  global.gc();
  const retained = process.memoryUsage();
  memory[label] = {
    heapBytesPerList:
      (retained.heapUsed - baseline.heapUsed) / instances.length,
    arrayBufferBytesPerList:
      (retained.arrayBuffers - baseline.arrayBuffers) / instances.length,
  };
  instances.length = 0;
}
console.log(JSON.stringify({ resize: results, memory }, null, 2));
