'use client';

import { withBasePath } from "@/lib/base-path";
import Image from 'next/image';

/*
 * Visitor-facing header: wordmark only. No wallet connect, no identity
 * prompts — visitors read anonymously. Author attribution lives in <meta>
 * tags and response headers (see layout.tsx, next.config.ts).
 */
export function Header() {
  return (
    <header className="p3-landing-hero w-full font-sans">
      <div className="p3-header-strip p3-content-shell">
        <div className="p3-header-left min-w-0 gap-5 sm:gap-7 md:gap-9 lg:gap-10">
          <div className="p3-header-emblem shrink-0">
            <Image
              src={withBasePath("/visuals/icon.png")}
              alt="Transition Insight logo"
              width={96}
              height={96}
              priority
              className="p3-header-logo object-contain"
            />
          </div>

          <div className="p3-header-brand">
            <h1 className="p3-brand-wordmark">
              <span className="p3-brand-title-main">Transition</span>
              <span className="p3-brand-title-sub">Insight</span>
            </h1>
            <p className="p3-brand-tagline">
              HUMAN-CENTRIC GOVERNANCE FOR A NEW EARTH
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
