"use client";
import { useRef, useEffect } from "react";

import { withBasePath } from "@/lib/base-path";

const preHydrationReveal = `(()=>{const watermark=document.currentScript?.previousElementSibling;if(!(watermark instanceof HTMLElement))return;addEventListener("mousemove",event=>{const rect=watermark.getBoundingClientRect(),centerX=rect.left+rect.width/2,centerY=rect.top+rect.height/2;watermark.classList.toggle("is-revealed",Math.hypot(event.clientX-centerX,event.clientY-centerY)<rect.width*.55)})})()`;

export function CompassWatermark() {
  const ref = useRef<HTMLDivElement>(null);

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
    <>
      <div ref={ref} className="p3-compass-watermark" aria-hidden="true">
        <img src={withBasePath("/visuals/sundial_letters_outer.svg")} alt="" />
      </div>
      <script dangerouslySetInnerHTML={{ __html: preHydrationReveal }} />
    </>
  );
}
