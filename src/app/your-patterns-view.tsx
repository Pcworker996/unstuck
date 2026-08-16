import type { YourPatterns } from "./your-patterns";

export function YourPatternsView({ patterns }: { patterns: YourPatterns }) {
  return (
    <section aria-labelledby="patterns-heading" className="patterns-card">
      <p className="eyebrow">Your Patterns</p>
      <h2 id="patterns-heading">What has helped in your history</h2>
      <p className="patterns-card__description">
        A focused view of helpful Pivots, Pivot time, and the Self-reported context
        that appears in your retained Check-ins. This is not a health score.
      </p>

      <div className="patterns-group">
        <h3>Helpful Pivots</h3>
        {patterns.helpfulPivots.length > 0 ? (
          <ul>
            {patterns.helpfulPivots.map((pattern) => (
              <li key={pattern.pivotId}>
                <strong>{pattern.pivotTitle}</strong>
                <p>
                  Helpful {pattern.helpfulOutcomeCount} {pluralize(pattern.helpfulOutcomeCount, "time")} ·{" "}
                  Typical Pivot time: {formatPivotTime(pattern.typicalPivotTimeSeconds)}
                </p>
                <MemoryLinks memoryIds={pattern.memoryIds} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="privacy-note">No helpful Pivot outcomes are recorded yet.</p>
        )}
      </div>

      <div className="patterns-group">
        <h3>Recurring Self-reported context</h3>
        {patterns.recurringContexts.length > 0 ? (
          <ul>
            {patterns.recurringContexts.map((pattern) => (
              <li key={pattern.label}>
                <strong>{pattern.label}</strong>
                <p>{pattern.checkInCount} {pluralize(pattern.checkInCount, "Check-in")}</p>
                <MemoryLinks memoryIds={pattern.memoryIds} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="privacy-note">No recurring Self-reported context yet.</p>
        )}
      </div>
    </section>
  );
}

function MemoryLinks({ memoryIds }: { memoryIds: readonly string[] }) {
  return (
    <p className="memory-links">
      {memoryIds.map((memoryId, index) => (
        <a href={`#${memoryAnchorId(memoryId)}`} key={memoryId}>
          {index === 0 ? "Inspect memory" : `Inspect memory ${index + 1}`}
        </a>
      ))}
    </p>
  );
}

function memoryAnchorId(memoryId: string): string {
  return `memory-${encodeURIComponent(memoryId)}`;
}

function formatPivotTime(seconds: number | undefined): string {
  if (seconds === undefined) {
    return "not recorded";
  }

  if (seconds < 60) {
    return `${seconds} sec`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds === 0
    ? `${minutes} min`
    : `${minutes} min ${remainingSeconds} sec`;
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}
