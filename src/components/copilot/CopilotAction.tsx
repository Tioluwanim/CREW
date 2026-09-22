import type { CopilotAction as CopilotActionType } from './copilot.types';
import { cn } from '../../lib/cn';

interface CopilotActionProps {
  action: CopilotActionType;
  onSelect: (action: CopilotActionType) => void;
  variant?: 'primary' | 'secondary';
}

export function CopilotAction({ action, onSelect, variant = 'secondary' }: CopilotActionProps) {
  return (
    <button
      onClick={() => onSelect(action)}
      className={cn(
        'rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500',
        variant === 'primary'
          ? 'bg-gold-500 text-ink-950 hover:bg-gold-500/90'
          : 'bg-white/10 text-bone-50 hover:bg-white/20',
      )}
    >
      {action.label}
    </button>
  );
}
