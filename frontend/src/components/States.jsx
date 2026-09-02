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
