import { motion } from 'framer-motion';

interface DepositSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  recommended?: number | null;
}

export function DepositSlider({ value, onChange, min = 0, max = 100, step = 5, recommended = null }: DepositSliderProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-medium text-ink-700">Deposit</span>
        <motion.span key={value} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className="num text-lg font-medium text-ink-900">
          {value}%
        </motion.span>
      </div>
      <div className="relative py-2">
        <div className="h-1.5 w-full rounded-full bg-ink-900/10">
          <div className="h-1.5 rounded-full bg-thread-600 transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        {recommended !== null && (
          <div
            className="pointer-events-none absolute top-0 h-full w-px bg-gold-500"
            style={{ left: `${((recommended - min) / (max - min)) * 100}%` }}
            aria-hidden
          />
        )}
        <input
          type="range"
          aria-label="Deposit percentage"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-x-0 top-0 h-5 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-thread-600 [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-thread-600"
        />
      </div>
      {recommended !== null && (
        <p className="mt-1 text-xs text-ink-500">
          Gold marker: {recommended}% is the lowest deposit that covers your costs upfront.
        </p>
      )}
    </div>
  );
}
