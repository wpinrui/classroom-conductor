/** − value + with an optional label in front. */
export function Stepper({
  label,
  value,
  onStep,
  min,
  max,
  current,
}: {
  label?: React.ReactNode;
  value: React.ReactNode;
  onStep: (delta: -1 | 1) => void;
  min: number;
  max?: number;
  current: number;
}) {
  return (
    <div className="stepper">
      {label}
      <button
        type="button"
        aria-label="Decrease"
        disabled={current <= min}
        onClick={() => onStep(-1)}
      >
        −
      </button>
      <output>{value}</output>
      <button
        type="button"
        aria-label="Increase"
        disabled={max !== undefined && current >= max}
        onClick={() => onStep(1)}
      >
        +
      </button>
    </div>
  );
}
