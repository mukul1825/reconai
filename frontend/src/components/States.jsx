import { AlertCircle, Inbox } from "lucide-react";

/**
 * Skeleton loading rows - not a spinner. A spinner tells you nothing about
 * what's coming; a skeleton in the shape of the real content sets
 * expectations and feels faster even at the same actual latency.
 */
export function SkeletonRows({ count = 5 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-11 rounded bg-line/50 animate-pulse" />
      ))}
    </div>
  );
}

/**
 * A row of differently-shaped blocks (badge-width, bar-width, text-width)
 * rather than one uniform gray bar - so the loading state actually
 * resembles the table it's about to become, not a generic placeholder
 * borrowed from a different kind of page.
 */
export function TableSkeleton({ rows = 5, columnWidths = ["w-16", "w-20", "w-24", "flex-1"] }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          {columnWidths.map((width, j) => (
            <div
              key={j}
              className={`h-4 rounded bg-line/60 animate-pulse ${width}`}
              style={{ animationDelay: `${i * 40}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-10 h-10 rounded-full bg-paper border border-line flex items-center justify-center mb-3">
        <Icon size={18} className="text-subtle" strokeWidth={1.75} />
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="text-sm text-subtle mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * Errors never apologize and are never vague about what happened - state
 * what went wrong and what to do about it, in the interface's own voice.
 */
export function ErrorBanner({ message, onRetry }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded border border-danger/20 bg-danger-soft">
      <AlertCircle size={16} className="text-danger mt-0.5 shrink-0" strokeWidth={2} />
      <div className="flex-1">
        <p className="text-sm text-danger font-medium">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm font-medium text-danger underline underline-offset-2 shrink-0"
        >
          Try again
        </button>
      )}
    </div>
  );
}
