import { useCallback, useEffect, useState } from "react";
import { VIEWS, VIEW_ORDER } from "@/navigation/views";

function getDirection(fromView, toView) {
  const fromIndex = VIEW_ORDER.indexOf(fromView);
  const toIndex = VIEW_ORDER.indexOf(toView);

  if (fromIndex === -1 || toIndex === -1) return "forward";
  return toIndex >= fromIndex ? "forward" : "back";
}

export default function useViewNavigation(initialView = VIEWS.DASHBOARD) {
  const [view, setView] = useState(initialView);
  const [navDirection, setNavDirection] = useState("forward");

  const navigateTo = useCallback(
    (nextView) => {
      if (!nextView || !VIEW_ORDER.includes(nextView)) {
        if (import.meta.env.DEV) {
          console.warn(`[navigation] Ignoring unknown view: ${String(nextView)}`);
        }
        return;
      }

      if (nextView === view) return;

      const direction = getDirection(view, nextView);
      setNavDirection(direction);

      if (typeof document !== "undefined") {
        document.documentElement.dataset.navDirection = direction;
      }

      const updateView = () => setView(nextView);
      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (
        !reduceMotion &&
        typeof document !== "undefined" &&
        typeof document.startViewTransition === "function"
      ) {
        document.startViewTransition(updateView);
        return;
      }

      updateView();
    },
    [view]
  );

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.navDirection = navDirection;
    }
  }, [navDirection]);

  return { view, navDirection, navigateTo };
}

