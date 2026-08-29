"use client";
import { useRef, useEffect, type CSSProperties } from "react";

import { withBasePath } from "@/lib/base-path";

type CompassWatermarkStyle = CSSProperties & {
  "--p3-compass-watermark-image": string;
};

export function CompassWatermark() {
  const ref = useRef<HTMLDivElement>(null);
  const style: CompassWatermarkStyle = {
    "--p3-compass-watermark-image": `url("${withBasePath("/visuals/sundial_letters_outer.svg")}")`,
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onMove(e: MouseEvent) {
      const r = el!.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      el!.classList.toggle("is-revealed", dist < r.width * 0.55);
    }

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div ref={ref} className="p3-compass-watermark" style={style} aria-hidden="true" />
  );
}
