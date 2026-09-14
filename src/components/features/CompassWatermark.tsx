import { withBasePath } from "@/lib/base-path";

/**
 * Server component + inline script (not "use client").
 *
 * Static Pages/IPFS HTML must reveal the wheel without waiting on React
 * hydration. A client-component <script> is stripped by React 19 / Next 16
 * ("Scripts inside React components are never executed"), which is why the
 * wheel kept "dropping" after that warning was "fixed" by deleting the script.
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
        <img src={withBasePath("/visuals/sundial_letters_outer.svg")} alt="" />
      </div>
      <script dangerouslySetInnerHTML={{ __html: revealScript }} />
    </>
  );
}
