import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { CashFlowPoint } from '../../types';
import { formatNairaCompact, formatNaira } from '../../lib/money';

export function CashFlowChart({ points }: { points: CashFlowPoint[] }) {
  const data = points.map((p) => ({ label: p.label, balance: p.projectedBalance }));

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
            formatter={(value) => [formatNaira(Number(value ?? 0)), 'Projected balance']}
            contentStyle={{ borderRadius: 10, border: '1px solid rgba(20,23,31,0.1)', fontSize: 13 }}
          />
          <Area type="monotone" dataKey="balance" stroke="#8a2c2c" strokeWidth={2} fill="url(#balanceFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
