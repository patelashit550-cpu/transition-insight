"use client";
import { useRef, useEffect } from "react";

import { withBasePath } from "@/lib/base-path";

function debugLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, boolean | number | string | null>,
) {
  const payload = JSON.stringify({
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  });
  navigator.sendBeacon("http://localhost:4174", payload);
}

export function CompassWatermark() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      // #region agent log
      debugLog("A", "CompassWatermark.tsx:25", "effect missing element", {});
      // #endregion
      return;
    }
    const watermark = el;

    const img = watermark.querySelector("img");
    const initialRect = watermark.getBoundingClientRect();
    const initialStyle = getComputedStyle(watermark);
    // #region agent log
    debugLog("A,C,D", "CompassWatermark.tsx:34", "effect mounted", {
      className: watermark.className,
      width: initialRect.width,
      height: initialRect.height,
      left: initialRect.left,
      top: initialRect.top,
      opacity: initialStyle.opacity,
      visibility: initialStyle.visibility,
      display: initialStyle.display,
      imageComplete: img?.complete ?? false,
      imageNaturalWidth: img?.naturalWidth ?? 0,
      imageSrc: img?.getAttribute("src") ?? null,
    });
    // #endregion

    // #region agent log
    debugLog("D", "CompassWatermark.tsx:51", "image initial state", {
      complete: img?.complete ?? false,
      naturalWidth: img?.naturalWidth ?? 0,
      naturalHeight: img?.naturalHeight ?? 0,
    });
    // #endregion

    let lastRevealed: boolean | null = null;

    function onMove(e: MouseEvent) {
      const r = watermark.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      const shouldReveal = dist < r.width * 0.55;
      if (shouldReveal !== lastRevealed) {
        // #region agent log
        debugLog("B", "CompassWatermark.tsx:66", "pointer threshold transition", {
          pointerX: e.clientX,
          pointerY: e.clientY,
          centerX: cx,
          centerY: cy,
          distance: dist,
          threshold: r.width * 0.55,
          shouldReveal,
        });
        // #endregion
      }
      watermark.classList.toggle("is-revealed", shouldReveal);
      if (shouldReveal !== lastRevealed) {
        const style = getComputedStyle(watermark);
        // #region agent log
        debugLog("B,C", "CompassWatermark.tsx:82", "class toggle result", {
          shouldReveal,
          classApplied: watermark.classList.contains("is-revealed"),
          opacity: style.opacity,
          filter: style.filter,
          zIndex: style.zIndex,
        });
        // #endregion
        lastRevealed = shouldReveal;
      }
    }

    window.addEventListener("mousemove", onMove);
    // #region agent log
    debugLog("A", "CompassWatermark.tsx:96", "mousemove listener attached", {});
    // #endregion
    return () => {
      window.removeEventListener("mousemove", onMove);
      // #region agent log
      debugLog("A", "CompassWatermark.tsx:102", "mousemove listener removed", {});
      // #endregion
    };
  }, []);

  return (
    <div ref={ref} className="p3-compass-watermark" aria-hidden="true">
      <img src={withBasePath("/visuals/sundial_letters_outer.svg")} alt="" />
    </div>
  );
}
