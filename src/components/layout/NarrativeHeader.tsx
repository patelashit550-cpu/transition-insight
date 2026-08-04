'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BentoRegistry } from '@/config/site';
import { withBasePath } from '@/lib/base-path';
import { resolveBentoKeyFromPathname } from '@/lib/nav-visibility-shared';
import { useNavVisibility } from '@/components/layout/NavVisibilityContext';
import { cn } from '@/lib/utils';

/*
 * Narrative / section header (used on /transition-insight/* reading routes).
 *
 * Shape: a 2-column grid defined in globals.css (`.p3-narrative-inner`):
 *   [ brand (links home) ] [ sibling nav, right-aligned ]
 *
 * The brand wordmark on the left is itself the home link (per long-standing
 * web convention, reinforced by the `aria-label="… — home"` on the anchor).
 * Sibling nav appears only at ≥900px; below that the landing bento is the
 * navigation fallback.
 *
 * Sibling nav is *section-aware*: we resolve the current pathname to one of
 * the three top-level bento sections (B1 Identity / B2 Governance / B3
 * Chronicle) and render that section's `series` as the links. Visiting
 * `/transition-insight/governance/semperidem` therefore shows the Governance siblings
 * rather than the Identity ones.
 *
 * `navLabelOverrides` shortens long titles for the nav display only; full
 * names remain in BentoRegistry / bento cards / article headers.
 */
const navLabelOverrides: Record<string, string> = {
  'The Trials of Job - A Retrospective': 'Trials of Job',
  'E Pluribus Unum': 'E Pluribus',
};

/** TrailingSlash + topic children: `/transition-insight/.../london_times/ronin/` → London Times hub active. */
function isSiblingNavActive(
  pathname: string | null | undefined,
  href: string
): boolean {
  const p = (pathname ?? "/").replace(/\/+$/, "") || "/";
  const h = href.replace(/\/+$/, "") || "/";
  return p === h || p.startsWith(`${h}/`);
}

/*
 * Resolve pathname → bento section. Matching is by URL segment rather than
 * exact-href so deeper routes (e.g. sub-essays under a series) still pick up
 * the correct sibling set. Chronicle has two roots today (`/transition-insight/chronicle`
 * and a legacy `/chronicle`), both mapped to B3.
 */
type BentoSection = (typeof BentoRegistry)[keyof typeof BentoRegistry];

const resolveSection = (pathname: string): BentoSection => {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p.startsWith("/transition-insight/governance") || p.startsWith("/governance")) {
    return BentoRegistry.B2;
  }
  if (p.startsWith("/transition-insight/chronicle") || p.startsWith("/chronicle")) {
    return BentoRegistry.B3;
  }
  return BentoRegistry.B1;
};

const NarrativeHeader = () => {
  const pathname = usePathname();
  const navPayload = useNavVisibility();
  const sectionKey = resolveBentoKeyFromPathname(pathname ?? '/');
  const filtered = navPayload?.[sectionKey];
  const section = resolveSection(pathname ?? '');
  const siblingItems = (
    filtered ??
    section.series.map((item) => ({ name: item.name, href: item.href as string, isNew: false }))
  ).map((item) => ({
    name: navLabelOverrides[item.name] ?? item.name,
    href: item.href,
    isNew: item.isNew === true,
  }));

  return (
    <header className="p3-narrative-header">
      <div className="p3-narrative-inner">
        <Link href="/" className="p3-narrative-brand" aria-label="Transition Insight — home">
          <span className="p3-narrative-brand__mark">
            <Image
              src={withBasePath("/visuals/icon.png")}
              alt=""
              aria-hidden="true"
              width={56}
              height={56}
              priority
            />
          </span>
          <span className="p3-narrative-brand__wordmark">
            <span className="p3-narrative-brand__wordmark--main">Transition</span>
            <span className="p3-narrative-brand__wordmark--sub">Insight</span>
          </span>
        </Link>

        <nav className="p3-narrative-nav" aria-label="Section">
          {siblingItems.map((item) => {
            const isActive = isSiblingNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn("p3-narrative-link", item.isNew && "p3-narrative-link--new")}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

export default NarrativeHeader;
