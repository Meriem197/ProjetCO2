import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, description, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-4 py-10 text-center", className)}>
      {Icon && <Icon className="h-9 w-9 text-muted-foreground/80" aria-hidden />}
      {title && <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>}
      {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}
