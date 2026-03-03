import * as React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode;
    className?: string;
    hoverEffect?: boolean;
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
    ({ children, className, hoverEffect = true, ...props }, ref) => {
        return (
            <motion.div
                ref={ref}
                whileHover={hoverEffect ? { scale: 1.02, y: -4, zIndex: 10 } : {}}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={cn(
                    "bg-surface-dark/60 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden relative",
                    "shadow-glass hover:shadow-glass-hover",
                    className
                )}
                {...props}
            >
                {children}
            </motion.div>
        );
    }
);

GlassCard.displayName = "GlassCard";
