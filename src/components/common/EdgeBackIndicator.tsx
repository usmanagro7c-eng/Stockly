import { ChevronLeft, ChevronRight } from "lucide-react";
import type { EdgeGestureState } from "@/hooks/use-mobile-back";
import { cn } from "@/lib/utils";

export function EdgeBackIndicator({ state }: { state: EdgeGestureState }) {
  if (!state.active || !state.side || state.progress <= 0.08) return null;

  const isLeft = state.side === "left";
  const isTriggered = state.progress >= 0.95;
  const topPos = Math.max(70, Math.min(window.innerHeight - 100, state.currentY));

  return (
    <div
      className={cn(
        "pointer-events-none fixed z-50 flex items-center transition-all duration-75 select-none",
        isLeft ? "left-0" : "right-0",
      )}
      style={{
        top: `${topPos}px`,
        transform: `translateY(-50%) translateX(${
          isLeft
            ? `${state.progress * 16}px`
            : `-${state.progress * 16}px`
        })`,
      }}
      aria-hidden="true"
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full shadow-xl backdrop-blur-md border transition-all duration-100",
          isLeft ? "rounded-l-none pl-1 pr-2.5" : "rounded-r-none pr-1 pl-2.5",
          isTriggered
            ? "size-11 border-primary/50 bg-primary text-primary-foreground shadow-primary/35 scale-110"
            : "size-10 border-border/80 bg-card/90 text-foreground shadow-black/40",
        )}
      >
        {isLeft ? (
          <ChevronLeft className="size-5 stroke-[2.5]" />
        ) : (
          <ChevronRight className="size-5 stroke-[2.5]" />
        )}
      </div>
    </div>
  );
}
