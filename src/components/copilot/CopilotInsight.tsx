import type { CopilotInsight as CopilotInsightType } from './copilot.types';
import { formatNaira } from '../../lib/money';

export function CopilotInsight({ insight }: { insight: CopilotInsightType }) {
  return (
    <div className="space-y-2">
      <p className="text-lg font-medium leading-snug text-bone-50">{insight.headline}</p>
      <p className="text-sm leading-relaxed text-bone-200/80">{insight.detail}</p>
      {typeof insight.value === 'number' && (
        <div className="num pt-1 text-3xl font-medium text-gold-500">{formatNaira(insight.value)}</div>
      )}
    </div>
  );
}
