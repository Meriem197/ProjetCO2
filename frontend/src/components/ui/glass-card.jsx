import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
export function GlassCard({ children, className, delay = 0, as = "div" }) {
    const Comp = motion[as];
    return (<Comp initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay, ease: [0.4, 0, 0.2, 1] }} className={cn(
        // Light: airy glass | Dark: smoky industrial glass (no big white slabs)
        "relative rounded-2xl border p-5 backdrop-blur-xl shadow-card",
        "bg-white/70 border-white/60",
        "dark:bg-slate-950/35 dark:border-white/10",
        // Subtle internal sheen
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:opacity-60",
        "before:bg-gradient-to-br before:from-white/40 before:to-transparent",
        "dark:before:from-cyan-400/10 dark:before:to-fuchsia-500/5",
        className
    )}>
      <div className="relative">{children}</div>
    </Comp>);
}
