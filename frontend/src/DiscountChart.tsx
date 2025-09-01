import { useEffect, useRef, useState } from "react";

interface TimeToBuy {
  time: Date | string | number;
  discountPercent: number;
}

export default function DiscountChart({
  data,
  onClose,
  title,
}: {
  data: TimeToBuy[];
  onClose: () => void;
  title?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const baseWidth = 680;
  const height = 320;
  const padding = 36;

  const [zoom, setZoom] = useState<number>(1); // multiplier for px per hour
  const [isPanning, setIsPanning] = useState(false);
  const panStartX = useRef<number>(0);
  const panStartScroll = useRef<number>(0);
  const [tooltip, setTooltip] = useState<{
    left: number;
    top: number;
    time: string;
    percent: number;
  } | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-lg p-6 w-full max-w-xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              {title || "Discount Chart"}
            </h3>
            <button onClick={onClose} className="text-red-600 font-bold">
              X
            </button>
          </div>
          <div>No data available</div>
        </div>
      </div>
    );
  }

  const points = data
    .map((d) => ({ t: new Date(d.time).getTime(), v: -d.discountPercent }))
    .sort((a, b) => a.t - b.t);

  const times = points.map((p) => p.t);
  const vals = points.map((p) => p.v);
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);

  const hoursSpan = Math.max(1, (maxT - minT) / (1000 * 60 * 60));
  const pxPerHourBase = 40; // base pixels per hour
  const pxPerHour = pxPerHourBase * zoom;
  const svgWidth = Math.max(
    baseWidth,
    padding * 2 + Math.ceil(hoursSpan * pxPerHour)
  );

  const hourMs = 1000 * 60 * 60;
  const currentHourStart = Math.floor(Date.now() / hourMs) * hourMs;
  const currentHourEnd = currentHourStart + hourMs;

  const xFor = (t: number) => {
    if (maxT === minT) return svgWidth / 2;
    return padding + ((t - minT) / (maxT - minT)) * (svgWidth - padding * 2);
  };

  const yFor = (v: number) => {
    // invert because SVG y increases downward
    if (maxV === minV) return height / 2;
    const normalized = (v - minV) / (maxV - minV);
    return padding + normalized * (height - padding * 2);
  };

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.t)} ${yFor(p.v)}`)
    .join(" ");

  const yTicks = 4;
  const yLabels = Array.from(
    { length: yTicks + 1 },
    (_, i) => minV + ((maxV - minV) * i) / yTicks
  ).reverse();

  // wheel: ctrl+wheel to zoom, otherwise let the container scroll horizontally
  const onWheel = (e: React.WheelEvent) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => Math.max(0.2, Math.min(8, z * delta)));
    }
  };

  // (visible-range logic removed because axis labels were disabled)

  // drag-to-pan: translate mouse drag into container scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMouseUp = () => setIsPanning(false);
    const onMouseMove = (ev: MouseEvent) => {
      if (!isPanning || !container) return;
      const dx = ev.clientX - panStartX.current;
      container.scrollLeft = panStartScroll.current - dx;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isPanning]);

  const startPan = (ev: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;
    setIsPanning(true);
    panStartX.current = ev.clientX;
    panStartScroll.current = container.scrollLeft;
  };

  const stopPan = () => setIsPanning(false);

  const zoomIn = () => setZoom((z) => Math.min(8, z * 1.25));
  const zoomOut = () => setZoom((z) => Math.max(0.2, z * 0.8));
  const resetZoom = () => {
    setZoom(1);
    // also reset scroll to left
    requestAnimationFrame(() => {
      const c = containerRef.current;
      if (c) c.scrollLeft = 0;
    });
  };

  // panLeft/panRight removed — use scroll or drag-to-pan

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg p-4 w-full max-w-6xl shadow-lg">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">{title || "Discount Chart"}</h3>
          <div className="flex items-center gap-2">
            <button onClick={zoomOut} className="px-2 py-1 bg-gray-200 rounded">
              -
            </button>
            <button onClick={zoomIn} className="px-2 py-1 bg-gray-200 rounded">
              +
            </button>
            <button
              onClick={resetZoom}
              className="px-2 py-1 bg-gray-200 rounded"
            >
              Reset
            </button>
            <button onClick={onClose} className="text-red-600 font-bold">
              X
            </button>
          </div>
        </div>

        <div
          ref={containerRef}
          onWheel={onWheel}
          className={`overflow-auto border rounded ${
            isPanning ? "cursor-grabbing" : "cursor-grab"
          }`}
          style={{ width: "100%", position: "relative" }}
        >
          <svg
            ref={svgRef}
            width={svgWidth}
            height={height}
            onMouseDown={startPan}
            onMouseUp={stopPan}
            onMouseLeave={stopPan}
          >
            {/* background grid */}
            {yLabels.map((label, i) => {
              const y = yFor(label);
              return (
                <g key={i}>
                  <line
                    x1={padding}
                    x2={svgWidth - padding}
                    y1={y}
                    y2={y}
                    stroke="#e6e6e6"
                    strokeWidth={1}
                  />
                  {/* y-axis label removed */}
                </g>
              );
            })}

            {/* x-axis labels removed */}

            {/* highlight current hour as a band */}
            {(() => {
              const xStart = xFor(currentHourStart);
              const xEnd = xFor(currentHourEnd);
              // intersect with chart inner bounds
              const left = Math.max(padding, Math.min(xStart, xEnd));
              const right = Math.min(
                svgWidth - padding,
                Math.max(xStart, xEnd)
              );
              const w = Math.max(0, right - left);
              if (w <= 0) return null;
              return (
                <rect
                  x={left}
                  y={padding}
                  width={w}
                  height={height - padding * 2}
                  fill="#fef3c7"
                  opacity={0.45}
                />
              );
            })()}

            {/* vertical hour grid lines */}
            {(() => {
              const hourMs = 1000 * 60 * 60;
              const firstHour = Math.floor(minT / hourMs) * hourMs;
              const count = Math.ceil((maxT - firstHour) / hourMs) + 1;
              return Array.from({ length: count }).map((_, i) => {
                const t = firstHour + i * hourMs;
                const x = xFor(t);
                // only render if within chart horizontal bounds
                if (x < padding - 1 || x > svgWidth - padding + 1) return null;
                return (
                  <line
                    key={`v-${i}`}
                    x1={x}
                    x2={x}
                    y1={padding}
                    y2={height - padding}
                    stroke="#f3f4f6"
                    strokeWidth={1}
                  />
                );
              });
            })()}

            {/* data path */}
            <path d={pathD} fill="none" stroke="#2563eb" strokeWidth={2} />

            {/* points with hover handlers */}
            {points.map((p, i) => {
              const x = xFor(p.t);
              const y = yFor(p.v);
              const d = new Date(p.t);
              const rawHour = d.getHours();
              const hour12num = rawHour % 12 === 0 ? 12 : rawHour % 12;
              const ampm = rawHour >= 12 ? "pm" : "am";
              const hour = `${hour12num}${ampm}`; // e.g. 7pm
              const timeText = `${d.getMonth() + 1}/${d.getDate()} ${hour}`;
              const pct = Number(p.v.toFixed(2));
              const onEnter = () => {
                const c = containerRef.current;
                if (!c) return;
                const left = x - c.scrollLeft;
                const top = y - 10;
                setTooltip({ left, top, time: timeText, percent: pct });
              };
              const onLeave = () => setTooltip(null);
              const isTen = p.v >= 9 && p.v <= 10;
              const circleFill = isTen ? "#80ef80" : "#fff";
              return (
                <g key={i}>
                  <circle
                    cx={x}
                    cy={y}
                    r={6}
                    fill={circleFill}
                    stroke="#2563eb"
                    strokeWidth={2}
                    onMouseEnter={onEnter}
                    onMouseLeave={onLeave}
                  >
                    <title>{`${
                      d.getMonth() + 1
                    }/${d.getDate()} ${d.getHours()}:00 — ${p.v.toFixed(
                      2
                    )}%`}</title>
                  </circle>
                </g>
              );
            })}

            {/* tooltip placeholder (rendered as HTML below svg) */}
          </svg>
          {tooltip && (
            <div
              style={{
                position: "absolute",
                left: tooltip.left,
                top: tooltip.top,
                transform: "translate(-50%, -100%)",
                pointerEvents: "none",
                zIndex: 50,
              }}
            >
              <div
                style={{
                  background: "white",
                  border: "1px solid #e5e7eb",
                  padding: "6px 8px",
                  borderRadius: 6,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                  fontSize: 12,
                  color: "#111827",
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <span style={{ color: "#374151" }}>{tooltip.time}</span>
                <span
                  style={{
                    color: tooltip.percent > 0 ? "#dc2626" : "#059669",
                    fontWeight: 600,
                  }}
                >
                  {tooltip.percent.toFixed(2)}%
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 text-right">
          <button onClick={onClose} className="px-3 py-1 rounded bg-gray-200">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
