import Script from "next/script";

import { withBasePath } from "@/lib/base-path";

/**
 * Server component + next/script (not "use client").
 *
 * Static Pages/IPFS HTML must reveal the wheel without waiting on React
 * hydration. A raw <script> inside a React component is rejected by
 * Next 16 ("Scripts inside React components are never executed").
 * next/script with afterInteractive keeps the same proximity reveal.
 */
const revealScript = `(()=>{const w=document.getElementById("p3-compass-watermark");if(!(w instanceof HTMLElement))return;addEventListener("mousemove",e=>{const r=w.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;w.classList.toggle("is-revealed",Math.hypot(e.clientX-x,e.clientY-y)<r.width*.55);});})();`;

export function CompassWatermark() {
  return (
    <>
      <div
        id="p3-compass-watermark"
        className="p3-compass-watermark"
        aria-hidden="true"
        suppressHydrationWarning
      >
        <img src={withBasePath("/visuals/skin.png")} alt="" />
      </div>
      <Script id="p3-compass-reveal" strategy="afterInteractive">
        {revealScript}
      </Script>
    </>
  );
}
