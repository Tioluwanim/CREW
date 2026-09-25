/**
 * The Copilot's visual identity: a circular gold ring around an abstract
 * "flow" glyph (two open arcs meeting a center point) — echoing the same
 * coin/thread motifs already established in the landing hero rather than
 * a generic sparkle icon or a cartoon assistant face. Kept as one small,
 * reusable component so the trigger button, the chat header, and each
 * assistant message bubble all carry the same identifiable mark.
 */
export function CopilotAvatarMark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#14171f" />
      <circle cx="12" cy="12" r="11" stroke="#b8944f" strokeWidth="1.1" />
      <path
        d="M15.6 8.2a5 5 0 1 0 0 7.6"
        stroke="#b8944f"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="12" cy="12" r="1.4" fill="#b8944f" />
    </svg>
  );
}
