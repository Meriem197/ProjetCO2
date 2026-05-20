import { cn } from "@/lib/utils";
const map = {
    good: {
        label: "Air sain",
        cls: "bg-status-good/10 text-status-good border-status-good/30",
        dot: "bg-status-good",
    },
    warning: {
        label: "Qualité moyenne",
        cls: "bg-status-warning/10 text-status-warning border-status-warning/30",
        dot: "bg-status-warning",
    },
    critical: {
        label: "Critique",
        cls: "bg-status-critical/10 text-status-critical border-status-critical/30",
        dot: "bg-status-critical",
    },
};
export function StatusBadge({ status, label, className, pulse }) {
    const cfg = map[status];
    return (<span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold", cfg.cls, className)}>
      <span className={cn("h-2 w-2 rounded-full", cfg.dot, pulse && status === "critical" && "animate-pulse-critical")}/>
      {label ?? cfg.label}
    </span>);
}
