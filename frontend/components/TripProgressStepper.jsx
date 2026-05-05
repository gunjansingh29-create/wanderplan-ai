import React from 'react';

/**
 * TripProgressStepper
 *
 * Renders a horizontal step indicator for the trip-planning wizard.
 *
 * IMPORTANT – avoid boolean coercion bugs:
 *   • Use explicit ternaries so JSX children are always a string/number/element,
 *     never a raw boolean (React silently drops `true`/`false` in development
 *     but production minifiers can coerce them to strings like "Y"/"N").
 *   • Use `condition ? 'active' : ''` for className, not `condition && 'active'`.
 */
export default function TripProgressStepper({ stages = [], current = 0 }) {
  if (stages.length === 0) return <div></div>;

  return (
    <div>
      {stages.map((stage, i) => {
        const isActive = i === current;
        const isDone = i < current;
        return (
          <div
            key={i}
            data-testid={`step-${i}`}
            className={isActive ? 'active' : ''}
          >
            <span className="step-indicator">
              {isDone ? '✓' : i + 1}
            </span>
            <span className="step-label">{stage}</span>
          </div>
        );
      })}
    </div>
  );
}
