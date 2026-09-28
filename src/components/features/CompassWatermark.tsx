"use client";

import { useEffect, useRef } from "react";

import { withBasePath } from "@/lib/base-path";

/**
 * Pointer-proximity reveal: toggle `is-revealed` when the cursor is within
 * `width * 0.55` of the watermark centre. Client listener only.
 */
export function CompassWatermark() {
  const watermarkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const watermark = watermarkRef.current;
    if (!watermark) return;

    const onMove = (event: MouseEvent) => {
      const rect = watermark.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      watermark.classList.toggle(
        "is-revealed",
        Math.hypot(event.clientX - x, event.clientY - y) < rect.width * 0.55,
      );
    };

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div
      id="p3-compass-watermark"
      ref={watermarkRef}
      className="p3-compass-watermark"
      aria-hidden="true"
    >
      <img src={withBasePath("/visuals/sundial_letters_outer.svg")} alt="" />
    </div>
  );
}
