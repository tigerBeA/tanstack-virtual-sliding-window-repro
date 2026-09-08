import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
} from "@tanstack/virtual-core";
import "./style.css";

const viewport = document.getElementById("cache-viewport");
const sizer = document.getElementById("cache-sizer");
const advance = document.getElementById("cache-advance");
const range = document.getElementById("cache-range");
const mismatches = document.getElementById("cache-mismatches");
const offset = document.getElementById("cache-offset");
let dispose;

function reset() {
  dispose?.();
  let messages = Array.from({ length: 20 }, (_, index) => index + 1);
  const getItemKey = (index) => messages[index];

  function render(instance) {
    sizer.style.height = `${instance.getTotalSize()}px`;
    const items = instance.getVirtualItems();
    sizer.replaceChildren(
      ...items.map((item) => {
        const messageId = messages[item.index];
        const row = document.createElement("div");
        row.className = "message cache-message";
        row.classList.toggle("cache-mismatch", item.key !== messageId);
        row.classList.toggle("cache-anchor", messageId === 9);
        row.dataset.messageId = String(messageId);
        row.dataset.cachedKey = String(item.key);
        row.style.transform = `translateY(${item.start}px)`;
        const keyLabel = document.createElement("span");
        keyLabel.textContent = `Cached key: ${item.key}`;
        row.append(`Message ${messageId}`, keyLabel);
        return row;
      }),
    );
    range.textContent = `Messages ${messages[0]}–${messages.at(-1)} · Count: ${messages.length}`;
    mismatches.textContent = String(
      items.filter((item) => item.key !== messages[item.index]).length,
    );
    offset.textContent = String(viewport.scrollTop);
  }

  const virtualizer = new Virtualizer({
    count: messages.length,
    getScrollElement: () => viewport,
    getItemKey,
    estimateSize: () => 50,
    initialOffset: 400,
    anchorTo: "end",
    followOnAppend: false,
    observeElementRect,
    observeElementOffset,
    scrollToFn: elementScroll,
    onChange: render,
  });

  dispose = virtualizer._didMount();
  render(virtualizer);
  virtualizer._willUpdate();
  render(virtualizer);
  advance.disabled = false;
  advance.onclick = () => {
    messages = [...messages.slice(1), messages.at(-1) + 1];
    virtualizer.setOptions({ ...virtualizer.options, count: messages.length });
    // Commit the new layout before the pending anchor is applied.
    render(virtualizer);
    virtualizer._willUpdate();
    render(virtualizer);
    advance.disabled = true;
  };
}

document.getElementById("cache-reset").onclick = reset;
reset();
