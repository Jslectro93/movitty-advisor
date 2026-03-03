import * as React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
};

export const StaggerContainer = React.forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
    ({ className, children, ...props }, ref) => (
        <motion.div
            ref={ref}
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className={cn(className)}
            {...props}
        >
            {children}
        </motion.div>
    )
);
StaggerContainer.displayName = "StaggerContainer";

export const StaggerItem = React.forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
    ({ className, children, ...props }, ref) => (
        <motion.div
            ref={ref}
            variants={itemVariants}
            className={cn(className)}
            {...props}
        >
            {children}
        </motion.div>
    )
);
StaggerItem.displayName = "StaggerItem";
