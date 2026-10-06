import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { CashFlowPoint } from '../../types';
import { formatNairaCompact, formatNaira } from '../../lib/money';

export type BandedPoint = CashFlowPoint & { low?: number; high?: number };

/**
 * `points` may carry `low`/`high` (a payment-timing range from the forecast service). When every point
 * has both, the range is drawn as a shaded band behind the expected line.
 */
export function CashFlowChart({ points }: { points: BandedPoint[] }) {
  const banded = points.length > 0 && points.every((p) => p.low !== undefined && p.high !== undefined);
  const data = points.map((p) => ({
    label: p.label,
    balance: p.projectedBalance,
    band: banded ? [p.low as number, p.high as number] : undefined,
    low: p.low,
    high: p.high,
  }));

  return (
    <div className="h-56 w-full sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8a2c2c" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#8a2c2c" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e5e0d5" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7286' }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => formatNairaCompact(v)}
            tick={{ fontSize: 12, fill: '#6b7286' }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <ReferenceLine y={0} stroke="#a7acb9" strokeDasharray="3 3" />
          <Tooltip
            formatter={(value, name) =>
              name === 'band' && Array.isArray(value)
                ? [`${formatNaira(Number(value[0]))} to ${formatNaira(Number(value[1]))}`, 'If clients pay late to on time']
                : [formatNaira(Number(value ?? 0)), 'Projected balance']
            }
            contentStyle={{ borderRadius: 10, border: '1px solid rgba(20,23,31,0.1)', fontSize: 13 }}
          />
          {banded && <Area type="monotone" dataKey="band" name="band" stroke="none" fill="#8a2c2c" fillOpacity={0.12} isAnimationActive={false} />}
          <Area type="monotone" dataKey="balance" stroke="#8a2c2c" strokeWidth={2} fill="url(#balanceFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
