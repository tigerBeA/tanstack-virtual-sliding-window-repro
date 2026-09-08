import React from "react";
import { createRoot } from "react-dom/client";
import { useVirtualizer } from "@tanstack/react-virtual";
import "./style.css";

const ROW_HEIGHT = 50;
const VIEWPORT_HEIGHT = 300;
const INITIAL_MESSAGES = Array.from({ length: 20 }, (_, index) => index + 1);

function MessageList({ parentRef }) {
  const [messages, setMessages] = React.useState(INITIAL_MESSAGES);
  const getItemKey = React.useCallback((index) => messages[index], [messages]);
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    getItemKey,
    estimateSize: () => ROW_HEIGHT,
    initialOffset: INITIAL_MESSAGES.length * ROW_HEIGHT - VIEWPORT_HEIGHT,
    anchorTo: "end",
    followOnAppend: true,
  });

  return (
    <>
      <div className="actions">
        <button
          id="append-trim"
          onClick={() => {
            setMessages((current) => [
              ...current.slice(1),
              current.at(-1) + 1,
            ]);
          }}
        >
          Append + trim oldest
        </button>
        <button
          id="append"
          onClick={() => {
            setMessages((current) => [...current, current.at(-1) + 1]);
          }}
        >
          Append only (control)
        </button>
        <button id="scroll-to-end" onClick={() => virtualizer.scrollToEnd()}>
          Go to latest
        </button>
      </div>
      <p id="window-range">
        Messages {messages[0]}–{messages.at(-1)} · Count: {messages.length}
      </p>
      <div
        id="scroll-container"
        ref={parentRef}
        tabIndex={0}
        aria-label="Messages"
        style={{
          height: VIEWPORT_HEIGHT,
          overflow: "auto",
          overflowAnchor: "none",
        }}
      >
        <div
          style={{ height: virtualizer.getTotalSize(), position: "relative" }}
        >
          {virtualizer.getVirtualItems().map((item) => (
            <div
              key={item.key}
              className="message"
              data-message-id={item.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: ROW_HEIGHT,
                transform: `translateY(${item.start}px)`,
              }}
            >
              Message {item.key}
              {item.index === messages.length - 1 && <span>Latest</span>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// Diagnostics update independently, so observing the DOM cannot rerender the list.
function ScrollMetrics({ parentRef }) {
  const [metrics, setMetrics] = React.useState(null);

  React.useEffect(() => {
    const element = parentRef.current;
    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = element;
      setMetrics({ scrollTop, scrollHeight, clientHeight });
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    observer.observe(element.firstElementChild);
    element.addEventListener("scroll", update);
    update();
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, [parentRef]);

  if (!metrics) return <p>Measuring...</p>;

  const gap = metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop;
  return (
    <section className="metrics" aria-live="polite">
      <p>
        Actual bottom gap: <strong id="bottom-gap">{gap.toFixed(2)}</strong> px
      </p>
      <pre>{JSON.stringify(metrics, null, 2)}</pre>
    </section>
  );
}

function Fixture() {
  const parentRef = React.useRef(null);
  return (
    <>
      <MessageList parentRef={parentRef} />
      <ScrollMetrics parentRef={parentRef} />
    </>
  );
}

function App() {
  const [resetCount, setResetCount] = React.useState(0);
  return (
    <main>
      <h1>Fixed-window append loses tail follow</h1>
      <p className="versions">
        react-virtual 3.14.11 / virtual-core 3.17.9 / React 19.2.8
      </p>
      <p>
        Start at a 0 px gap. Click <b>Append + trim oldest</b>: the message count
        stays at 20. Expected: stay at the bottom. Compare with ordinary append
        after resetting.
      </p>
      <div className="reset-row">
        <code>anchorTo: "end", followOnAppend: true</code>
        <button id="reset" onClick={() => setResetCount((count) => count + 1)}>
          Reset
        </button>
      </div>
      <Fixture key={resetCount} />
      <p className="note">
        Reading control: reset, scroll upward, then append + trim. A retained
        message should stay at the same position in the viewport.
      </p>
      <p className="note">
        Fixed 50 px rows. 300 px viewport. No network, dynamic measurement, or
        custom scrolling. Native CSS scroll anchoring is disabled.
      </p>
      <a href="https://github.com/tigerBeA/tanstack-virtual-sliding-window-repro">
        Source and reproduction steps
      </a>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
