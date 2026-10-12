import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { App as CapacitorApp } from "@capacitor/app";
import { toast } from "sonner";

export interface EdgeGestureState {
  active: boolean;
  side: "left" | "right" | null;
  progress: number; // 0 to 1
  currentY: number;
}

const EDGE_THRESHOLD = 38; // px from screen border to initiate gesture
const TRIGGER_DISTANCE = 55; // px horizontal drag to trigger back
const MAX_VERTICAL_OFFSET = 65; // px vertical deviation allowed

export function useMobileBack({
  moreOpen,
  setMoreOpen,
}: {
  moreOpen: boolean;
  setMoreOpen: (open: boolean) => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const moreOpenRef = useRef(moreOpen);
  moreOpenRef.current = moreOpen;

  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const lastBackPressRef = useRef(0);
  const [edgeState, setEdgeState] = useState<EdgeGestureState>({
    active: false,
    side: null,
    progress: 0,
    currentY: 0,
  });

  /**
   * Central Back Handler:
   * 1. Closes open navigation drawers or modals first.
   * 2. If on subpages, navigates back in history (or to root "/").
   * 3. If on home "/", asks user to press back once more to exit.
   */
  const handleBack = useCallback(() => {
    // 1. Close "More" drawer if open
    if (moreOpenRef.current) {
      setMoreOpen(false);
      return true;
    }

    // 2. Close any active modal dialogs (Radix Dialog, ConfirmDialog, PDF modal)
    const activeDialogClose = document.querySelector<HTMLElement>(
      '[role="dialog"] button[aria-label*="Close"], [role="dialog"] button:has(.lucide-x), [data-state="open"] button[aria-label*="Close"]',
    );
    if (activeDialogClose) {
      activeDialogClose.click();
      return true;
    }

    // 3. Navigate back if on any subpage
    if (pathnameRef.current !== "/") {
      if (typeof window !== "undefined" && window.history.length > 1) {
        window.history.back();
      } else {
        void navigate({ to: "/" });
      }

      // Gentle haptic feedback
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(12);
        } catch {
          // ignore
        }
      }
      return true;
    }

    // 4. On root "/" page: Double-tap to exit prevention
    const now = Date.now();
    if (now - lastBackPressRef.current < 2000) {
      CapacitorApp.exitApp().catch(() => {});
      return false;
    } else {
      lastBackPressRef.current = now;
      toast.info("Press back again to exit Stockly", { duration: 2000 });
      return false;
    }
  }, [setMoreOpen, navigate]);

  // 1. Android Native Back Button & System Navigation Gesture listener
  useEffect(() => {
    let removeListener: (() => void) | null = null;

    try {
      const listenerPromise = CapacitorApp.addListener("backButton", () => {
        handleBack();
      });
      listenerPromise
        .then((handle) => {
          removeListener = () => handle.remove();
        })
        .catch(() => {});
    } catch {
      // Non-capacitor web environment
    }

    return () => {
      if (removeListener) removeListener();
    };
  }, [handleBack]);

  // 2. Touch Screen Edge Swipe Inward (Left & Right Edge) Navigation
  useEffect(() => {
    if (typeof window === "undefined") return;

    let startX = 0;
    let startY = 0;
    let isTracking = false;
    let side: "left" | "right" | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        isTracking = false;
        setEdgeState({ active: false, side: null, progress: 0, currentY: 0 });
        return;
      }

      const touch = e.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      const width = window.innerWidth;

      if (startX <= EDGE_THRESHOLD) {
        isTracking = true;
        side = "left";
        setEdgeState({ active: true, side: "left", progress: 0, currentY: startY });
      } else if (startX >= width - EDGE_THRESHOLD) {
        isTracking = true;
        side = "right";
        setEdgeState({ active: true, side: "right", progress: 0, currentY: startY });
      } else {
        isTracking = false;
        side = null;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isTracking || !side) return;
      const touch = e.touches[0];
      if (!touch) return;
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      // If user is clearly scrolling vertically, cancel edge gesture
      if (Math.abs(deltaY) > MAX_VERTICAL_OFFSET) {
        isTracking = false;
        side = null;
        setEdgeState({ active: false, side: null, progress: 0, currentY: 0 });
        return;
      }

      // Compute progress
      let dragDistance = 0;
      if (side === "left") {
        dragDistance = Math.max(0, deltaX);
      } else {
        dragDistance = Math.max(0, -deltaX);
      }

      const progress = Math.min(1, dragDistance / TRIGGER_DISTANCE);
      setEdgeState({
        active: true,
        side,
        progress,
        currentY: touch.clientY,
      });
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!isTracking || !side) {
        setEdgeState({ active: false, side: null, progress: 0, currentY: 0 });
        return;
      }

      const touch = e.changedTouches[0];
      if (!touch) {
        isTracking = false;
        side = null;
        setEdgeState({ active: false, side: null, progress: 0, currentY: 0 });
        return;
      }
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      const isValidSwipe =
        Math.abs(deltaY) <= MAX_VERTICAL_OFFSET &&
        ((side === "left" && deltaX >= TRIGGER_DISTANCE) ||
          (side === "right" && deltaX <= -TRIGGER_DISTANCE));

      if (isValidSwipe) {
        handleBack();
      }

      isTracking = false;
      side = null;
      setEdgeState({ active: false, side: null, progress: 0, currentY: 0 });
    };

    const onTouchCancel = () => {
      isTracking = false;
      side = null;
      setEdgeState({ active: false, side: null, progress: 0, currentY: 0 });
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [handleBack]);

  return { handleBack, edgeState };
}
