import { cn } from "@/lib/utils";

type AnimatedSkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function AnimatedSkeleton({ className, ...props }: AnimatedSkeletonProps) {
    return (
        <div
            className={cn(
                "animate-pulse rounded-md bg-white/10 relative overflow-hidden",
                className
            )}
            {...props}
        >
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </div>
    );
}
