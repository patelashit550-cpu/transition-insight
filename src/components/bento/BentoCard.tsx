'use client'

import React, { forwardRef, useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { ForwardedRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface BentoItem {
  label: string
  sublabel: string
  href?: string
  /** Shown on home bento: brief highlight when the gate has a recent `publishedAt`. */
  isNew?: boolean
}

interface BentoProps {
  /** Devanagari lead for the kicker line (Satyam / Shivam / Sundaram). */
  nodeKicker: string
  nodeId: string
  title: string
  subtitle: string
  titleVisualSrc?: string
  titleVisualAlt?: string
  items?: BentoItem[]
  children?: React.ReactNode
  /** Parent frame has a fixed row height; we set a pixel `max-height` on the list so it can scroll. */
  equalRow?: boolean
  /** Bottom-left colophon (Ab MCMLXIX) — Identity / B1 only. */
  showColophon?: boolean
}

function assignRef<T>(r: ForwardedRef<T> | null, el: T | null) {
  if (typeof r === "function") r(el)
  else if (r) (r as React.MutableRefObject<T | null>).current = el
}

export const BentoCard = forwardRef<HTMLDivElement, BentoProps>(function BentoCard(
  {
  nodeKicker,
  nodeId,
  title,
  subtitle,
  titleVisualSrc,
  titleVisualAlt,
  items,
  children,
  equalRow = false,
  showColophon = false,
  },
  ref
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);

  const setRootRef = useCallback(
    (el: HTMLDivElement | null) => {
      rootRef.current = el;
      assignRef(ref, el);
    },
    [ref]
  );

  const applyScrollerCap = useCallback(() => {
    const root = rootRef.current;
    const sc = scrollerRef.current;
    if (!root || !sc) return;
    const g = getComputedStyle(root);
    const borderBottom = parseFloat(g.borderBottomWidth) || 0;
    const padBottom = parseFloat(g.paddingBottom) || 0;
    const r = root.getBoundingClientRect();
    const s = sc.getBoundingClientRect();
    const innerBottom = r.bottom - borderBottom - padBottom;
    const maxH = Math.max(0, Math.floor(innerBottom - s.top));
    sc.style.maxHeight = maxH < 1 ? "" : `${maxH}px`;
  }, []);

  const updateScrollCues = useCallback(() => {
    const sc = scrollerRef.current;
    if (!sc) {
      setShowTopFade(false);
      setShowBottomFade(false);
      return;
    }
    const maxScrollTop = sc.scrollHeight - sc.clientHeight;
    const canScroll = maxScrollTop > 1;
    const top = sc.scrollTop <= 1;
    const bottom = sc.scrollTop >= maxScrollTop - 1;
    setShowTopFade(canScroll && !top);
    setShowBottomFade(canScroll && !bottom);
  }, []);

  useLayoutEffect(() => {
    if (!equalRow) {
      const sc = scrollerRef.current;
      if (sc) sc.style.maxHeight = "";
      setShowTopFade(false);
      setShowBottomFade(false);
      return;
    }
    const root = rootRef.current;
    const sc = scrollerRef.current;
    if (!root || !sc) return;
    let roRoot: ResizeObserver | null = null;
    let roScroller: ResizeObserver | null = null;
    const run = () => {
      requestAnimationFrame(() => {
        applyScrollerCap();
        updateScrollCues();
      });
    };
    run();
    roRoot = new ResizeObserver(run);
    roRoot.observe(root);
    roScroller = new ResizeObserver(run);
    roScroller.observe(sc);
    const onResize = () => run();
    const onScroll = () => updateScrollCues();
    sc.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    void document.fonts?.ready?.then?.(run);
    return () => {
      roRoot?.disconnect();
      roScroller?.disconnect();
      sc.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [equalRow, applyScrollerCap, updateScrollCues, nodeKicker, nodeId, title, subtitle, titleVisualSrc, items?.length]);

  const itemList = items?.map((item, idx) => {
    const body = (
      <>
        <h3 className="bento-category-title">{item.label}</h3>
        <p className="bento-category-sub">{item.sublabel}</p>
      </>
    );
    const rowClass = cn(
      "bento-row group/item bento-row-stack rounded-sm",
      item.href
        ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
        : "cursor-default",
      item.isNew && "bento-row--new"
    );
    return item.href ? (
      <Link
        key={idx}
        href={item.href}
        className={rowClass}
      >
        {body}
      </Link>
    ) : (
      <div key={idx} className={rowClass}>
        {body}
      </div>
    );
  });

  const titleSection = (
    <>
      <p className="bento-box-kicker">
        <span className="bento-box-kicker__script" lang="sa">
          {nodeKicker}
        </span>
        <span className="bento-box-kicker__suffix">{` // ${nodeId}`}</span>
      </p>

      <div className="bento-header-title-row">
        <h2 className="bento-box-title text-2xl font-bold tracking-tight sm:text-3xl">
          {title.toUpperCase()}
        </h2>
        {titleVisualSrc && (
          <span className="bento-box-title-visual-slot">
            <Image
              src={titleVisualSrc}
              alt={titleVisualAlt ?? `${title} visual`}
              width={421}
              height={480}
              className="bento-box-title-visual"
              priority
            />
          </span>
        )}
      </div>

      <div className="bento-header-category">
        <p className="bento-box-subtitle">{subtitle}</p>
        <div className="bento-title-accent-line" aria-hidden />
      </div>
    </>
  );

  return (
    <div
      ref={setRootRef}
      className="jurisdiction-card group bento-card-surface w-full h-full min-w-0 min-h-0"
    >
      <div
        className="card-content flex h-full min-h-0 flex-col font-sans"
      >
        <div className="bento-header-stack shrink-0">
          {titleSection}
        </div>

        <nav
          className={cn(
            "bento-card-nav min-h-0",
            equalRow && "bento-card-nav--equal",
            equalRow && showTopFade && "bento-card-nav--show-top-fade",
            equalRow && showBottomFade && "bento-card-nav--show-bottom-fade"
          )}
        >
          {equalRow ? (
            <div ref={scrollerRef} className="bento-nav-scroller">
              {itemList}
              {children && <div className="mt-6">{children}</div>}
            </div>
          ) : (
            <>
              {itemList}
              {children && <div className="mt-6">{children}</div>}
            </>
          )}
        </nav>

        {showColophon && (
          <p className="bento-box-colophon" lang="la">
            Ab MCMLXIX
          </p>
        )}
      </div>
    </div>
  );
});

export default BentoCard
