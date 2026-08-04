"use client";

import type { CSSProperties } from "react";
import { useLayoutEffect, useRef, useState, useEffect, useCallback, useSyncExternalStore } from "react";

import { BentoCard } from "./BentoCard";
import { BentoRegistry } from "@/config/site";
import type { BentoKey, NavVisibilityPayload } from "@/lib/nav-visibility-shared";
import { cn } from "@/lib/utils";

const MD_MIN = 768;
const WIDE_MQ = `(min-width: ${MD_MIN}px)`;
const MIN_ROW_PX = 180;
/** Read landing bottom pad from CSS so equal-row height leaves breathing room below cards. */
function getLandingBottomPadPx(): number {
  const home = document.querySelector(".p3-landing-home");
  if (!home) return 48;
  const pad = parseFloat(getComputedStyle(home).paddingBottom);
  return Number.isFinite(pad) && pad > 0 ? pad : 48;
}

function getAvailableRowHeight(): number {
  if (typeof window === "undefined") return Number.POSITIVE_INFINITY;
  const header = document.querySelector(".p3-landing-hero");
  const viewportH = window.visualViewport?.height ?? window.innerHeight;
  const top = header?.getBoundingClientRect().bottom ?? 0;
  return Math.max(0, Math.floor(viewportH - top - getLandingBottomPadPx()));
}

function subscribeWideMq(onStoreChange: () => void): () => void {
  const m = window.matchMedia(WIDE_MQ);
  m.addEventListener("change", onStoreChange);
  return () => m.removeEventListener("change", onStoreChange);
}

function getWideMqSnapshot(): boolean {
  return window.matchMedia(WIDE_MQ).matches;
}

type Props = { visible: NavVisibilityPayload };

/**
 * `md+`: equal-height row capped to the viewport band below the header.
 * Shorter columns stretch; taller columns scroll inside `.bento-nav-scroller`.
 */
export function BentoHomeEqualRows({ visible }: Props) {
  const frameRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const [rowPx, setRowPx] = useState<number | null>(null);
  const [layoutPass, setLayoutPass] = useState(0);
  
  /** SSR + first client tick match `false` so markup hydrates; syncs via `useSyncExternalStore`. */
  const isWide = useSyncExternalStore(subscribeWideMq, getWideMqSnapshot, () => false);

  /** Client-only gate so equal-row layout does not flash before hydration. */
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  
  const visKey = JSON.stringify(visible);

  const measureTallestFrame = useCallback((): void => {
    const els = frameRefs.current;
    if (els.length !== 3 || els.some((e) => e == null)) return;
    const hs = els.map((el) => Math.ceil(el!.getBoundingClientRect().height));
    if (hs.some((h) => h < 1)) return;
    const natural = Math.max(hs[0]!, hs[1]!, hs[2]!);
    const available = getAvailableRowHeight();
    if (available < 1) return;
    const h = Math.max(MIN_ROW_PX, Math.min(natural, available));
    setRowPx((p) => (p === h ? p : h));
  }, []);

  useLayoutEffect(() => {
    if (!isWide) return;

    measureTallestFrame();

    let cancelled = false;
    let raf0 = 0;
    let raf1 = 0;
    raf0 = requestAnimationFrame(() => {
      if (cancelled) return;
      measureTallestFrame();
      raf1 = requestAnimationFrame(() => {
        if (!cancelled) measureTallestFrame();
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf0);
      cancelAnimationFrame(raf1);
    };
  }, [isWide, visKey, layoutPass, measureTallestFrame]);

  useLayoutEffect(() => {
    if (!isWide) return;
    const seen = new Set<HTMLDivElement>();
    for (const el of frameRefs.current) {
      if (el) seen.add(el);
    }
    if (seen.size < 1) return;

    const ro = new ResizeObserver(() => {
      measureTallestFrame();
    });
    for (const el of seen) {
      ro.observe(el);
    }
    return () => {
      ro.disconnect();
    };
  }, [isWide, visKey, measureTallestFrame]);

  useEffect(() => {
    if (!isWide) {
      setRowPx(null);
      return;
    }
    const onResize = () => {
      setRowPx(null);
      setLayoutPass((n) => n + 1);
    };
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, [isWide]);

  useEffect(() => {
    if (!isWide) return;
    setRowPx(null);
  }, [isWide, visKey]);

  useEffect(() => {
    if (typeof document === "undefined" || !isWide) return;
    void document.fonts?.ready?.then?.(() => setLayoutPass((n) => n + 1));
  }, [isWide, visKey]);

  // Only equalize if components are mounted on the client AND matching wide criteria
  const isEqual = mounted && isWide && rowPx != null;

  return (
    <div
      className={cn(
        "bento-container bento-container--home w-full",
        isEqual && "bento-container--home-equal"
      )}
    >
      {(Object.keys(BentoRegistry) as BentoKey[]).map((key, index) => {
        const section = BentoRegistry[key];
        const newByHref = new Map(
          visible[key].map((v) => [v.href, v.isNew === true] as const)
        );
        const allowedHrefs = new Set(visible[key].map((v) => v.href));
        const items = section.series
          .filter((item) => allowedHrefs.has(item.href as string))
          .map((item) => {
            const href = item.href as string;
            return {
              label: item.name,
              sublabel: item.desc,
              href,
              isNew: newByHref.get(href) === true,
            };
          });

        const frameStyle: CSSProperties | undefined =
          isEqual && rowPx != null
            ? { height: rowPx, minHeight: 0, maxHeight: rowPx, boxSizing: "border-box" as const }
            : undefined;

        return (
          <div
            key={key}
            ref={(el) => {
              frameRefs.current[index] = el;
            }}
            className="bento-home-card-frame min-w-0 min-h-0 flex flex-col"
            style={frameStyle}
          >
            <BentoCard
              equalRow={isEqual}
              nodeKicker={section.nodeKicker}
              nodeId={section.label}
              title={section.title}
              subtitle={section.subtitle}
              titleVisualSrc={section.titleVisualSrc}
              titleVisualAlt={section.titleVisualAlt}
              items={items}
              showColophon={key === "B1"}
            />
          </div>
        );
      })}
    </div>
  );
}