interface Props {
  plan: "free" | "student" | "pro" | "team";
  className?: string;
}

const STYLES: Record<string, string> = {
  free:    "bg-surface-2 text-text-secondary border-border",
  student: "bg-green-600/10 text-green-700 border-green-500/30",
  pro:     "bg-green-600/10 text-green-700 border-green-500/30",
  team:    "bg-emerald-600/10 text-emerald-700 border-emerald-500/30",
};

const LABELS: Record<string, string> = {
  free:    "Free",
  student: "Student",
  pro:     "Pro",
  team:    "Team",
};

export function PlanBadge({ plan, className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center border rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[plan] ?? STYLES.free} ${className}`}
    >
      {LABELS[plan] ?? plan}
    </span>
  );
}
