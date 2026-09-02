/**
 * The one signature visual device, repeated everywhere a match appears
 * (dashboard, exceptions table, audit log). Deliberately NOT a gauge, ring,
 * or percentage badge - those read as decorative. This is a thin fill bar,
 * the same shape a progress indicator would take, because confidence really
 * is "how much of the way to certain are we" - the shape should say that.
 *
 * Color bands map to the same thresholds the decision policy actually uses
 * (see backend/src/services/scoring/decisionPolicy.js) - this isn't a
 * separate arbitrary scale, it's a visual rendering of the real logic.
 */
export default function ConfidenceBar({ value, size = "default" }) {
  const pct = Math.round(value * 100);

  let colorClass = "bg-danger";
  if (value >= 0.9) colorClass = "bg-success";
  else if (value >= 0.5) colorClass = "bg-warning";

  const height = size === "small" ? "h-1" : "h-1.5";
  const width = size === "small" ? "w-12" : "w-16";

  return (
    <div className="flex items-center gap-2">
      <div className={`${width} ${height} rounded-full bg-line overflow-hidden`}>
        <div
          className={`${height} ${colorClass} rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs text-subtle tabular-nums">{pct}%</span>
    </div>
  );
}
