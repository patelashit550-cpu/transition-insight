"use client"

import type { JSX } from "react"

type Props = {
  voiceUrl?: string
  messageUrl?: string
  chatUrl?: string
  email?: string
  xUrl?: string
  linkedinUrl?: string
}

const ALLOWED_PROTOCOLS = ["https:", "http:", "mailto:", "tel:", "tg:", "sip:"]

/**
 * Prefer https://t.me/… over tg:// — custom schemes often no-op in desktop
 * browsers when Telegram Desktop is not registered as a protocol handler.
 */
function normalizeContactHref(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === "tg:") {
      const domain = parsed.searchParams.get("domain")
      if (domain) return `https://t.me/${domain}`
    }
  } catch {
    /* fall through */
  }
  return url
}

function safeHref(url: string | undefined): string | undefined {
  if (!url) return undefined
  const normalized = normalizeContactHref(url)
  try {
    const { protocol } = new URL(normalized)
    return ALLOWED_PROTOCOLS.includes(protocol) ? normalized : undefined
  } catch {
    return undefined
  }
}

/** Only http(s) open in a new tab — tel/mailto/tg need same-tab handoff to the OS. */
function opensInNewTab(href: string): boolean {
  try {
    const { protocol } = new URL(href)
    return protocol === "http:" || protocol === "https:"
  } catch {
    return false
  }
}

type ChannelIcon = ({ className }: { className?: string }) => JSX.Element

type Channel = {
  id: string
  label: string
  ariaLabel: string
  href?: string
  icon: ChannelIcon
  /** Public profile that is also you — rel="me" for identity verification. */
  profile?: boolean
}

const iconSvgProps = {
  fill: "none" as const,
  strokeWidth: 1,
  stroke: "currentColor",
  strokeLinecap: "square" as const,
  "aria-hidden": true as const,
}

function IconCall({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...iconSvgProps}>
      <path
        strokeLinejoin="round"
        d="M6.6 10.8a15.2 15.2 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24 11.4 11.4 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C9.61 21 3 14.39 3 6.5a1 1 0 0 1 1-1H8a1 1 0 0 1 1 1c0 1.26.2 2.47.6 3.6a1 1 0 0 1-.25 1L6.6 10.8z"
      />
    </svg>
  )
}

function IconChat({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...iconSvgProps}>
      <path strokeLinejoin="round" d="M22 2L11 13" />
      <path strokeLinejoin="round" d="M22 2L15 22L11 13L2 9L22 2Z" />
    </svg>
  )
}

function IconLetter({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...iconSvgProps}>
      <path strokeLinejoin="miter" d="M2 6h20v14H2V6z" />
      <path strokeLinejoin="miter" d="M2 6l10 9 10-9" />
    </svg>
  )
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...iconSvgProps}>
      <path strokeLinejoin="miter" d="M4 3h4.5L20 21h-4.5L4 3z" />
      <path strokeLinejoin="miter" d="M19.5 3L13.4 10.1M10.6 13.9L4.5 21" />
    </svg>
  )
}

function IconLinkedIn({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...iconSvgProps}>
      <path strokeLinejoin="miter" d="M2 2h20v20H2V2z" />
      <path strokeLinejoin="miter" d="M7 10v8M7 6.5v1M11 18v-8M11 13.5c0-2 1.4-3.5 3.2-3.5S17 11 17 13v5" />
    </svg>
  )
}

export function ConnexionContactPanel({
  voiceUrl,
  messageUrl,
  chatUrl,
  email,
  xUrl,
  linkedinUrl,
}: Props) {
  const mailto = email ? safeHref(`mailto:${email}`) : undefined
  const channels: Channel[] = [
    {
      id: "call",
      label: "Call",
      ariaLabel: "Voice call",
      href: safeHref(voiceUrl),
      icon: IconCall,
    },
    {
      id: "message",
      label: "Telegram",
      ariaLabel: "Send a Telegram message",
      href: safeHref(messageUrl ?? chatUrl),
      icon: IconChat,
    },
    {
      id: "email",
      label: "Email",
      ariaLabel: "Send email",
      href: mailto,
      icon: IconLetter,
    },
    {
      id: "x",
      label: "X",
      ariaLabel: "Ashit Milne on X",
      href: safeHref(xUrl),
      icon: IconX,
      profile: true,
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      ariaLabel: "Ashit Milne on LinkedIn",
      href: safeHref(linkedinUrl),
      icon: IconLinkedIn,
      profile: true,
    },
  ].filter((c) => Boolean(c.href))

  return (
    <section className="p3-connexion-panel p3-connexion-panel--fit border border-emerald-500/60 bg-neutral-950">
      <nav aria-label="Contact options" className="p3-connexion-panel__nav">
        <ul className={`p3-connexion-contact-list p3-connexion-contact-list--n${channels.length} m-0 list-none p-0`}>
          {channels.map((ch) => {
            const Icon = ch.icon
            const href = String(ch.href)
            const newTab = opensInNewTab(href)
            return (
              <li key={ch.id}>
                <a
                  href={ch.href}
                  target={newTab ? "_blank" : undefined}
                  rel={newTab ? (ch.profile ? "me noopener" : "noreferrer") : undefined}
                  className="group p3-connexion-key"
                  aria-label={ch.ariaLabel}
                >
                  <span className="p3-connexion-key__glyph text-zinc-400 transition-colors duration-300 group-hover:text-emerald-400">
                    <Icon />
                  </span>
                  <span className="p3-connexion-key__label text-xs text-zinc-500 transition-colors duration-300 group-hover:text-emerald-400 mt-1 tracking-wide uppercase">
                    {ch.label}
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
    </section>
  )
}
