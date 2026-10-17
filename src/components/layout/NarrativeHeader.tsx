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
  // Telamon's header nav gained an eighth link when V≡RT moved into Bento 2; the short mark keeps it on one line.
  'Argonaut Agentic': 'Argo',
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

const utilityHrefs = new Set<string>(
  Object.values(BentoRegistry).flatMap((section) =>
    section.series.filter((item) => item.variant === "utility").map((item) => item.href)
  )
);

const NarrativeHeader = () => {
  const pathname = usePathname();
  const navPayload = useNavVisibility();
  const sectionKey = resolveBentoKeyFromPathname(pathname ?? '/');
  const filtered = navPayload?.[sectionKey];
  // Pathname → bento section comes from `resolveBentoKeyFromPathname` (one source of truth:
  // governance → B2, V≡RT's /chronicle/argonaut-agentic → B2, other chronicle → B3, else B1).
  const section = BentoRegistry[sectionKey];
  const siblingItems = (
    filtered ??
    section.series.map((item) => ({ name: item.name, href: item.href as string, isNew: false }))
  )
    // Utility rows (V≡RT) stay off the header nav except on their own page: the header was
    // already at its width limit with Telamon's seven links.
    .filter((item) => !utilityHrefs.has(item.href) || isSiblingNavActive(pathname, item.href))
    .map((item) => ({
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
