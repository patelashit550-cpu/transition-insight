"use client"

import type { JSX } from "react"

type Props = {
  voiceUrl?: string
  messageUrl?: string
  chatUrl?: string
  email?: string
  solanaAddress?: string
  validatorName?: string
}

const ALLOWED_PROTOCOLS = ["https:", "http:", "mailto:", "tel:", "tg:", "sip:"]

function safeHref(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    const { protocol } = new URL(url)
    return ALLOWED_PROTOCOLS.includes(protocol) ? url : undefined
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

function abbrevAddr(addr: string, head = 6, tail = 4): string {
  if (addr.length <= head + tail + 3) return addr
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`
}

type ChannelIcon = ({ className }: { className?: string }) => JSX.Element

type Channel = {
  id: string
  label: string
  ariaLabel: string
  href?: string
  icon: ChannelIcon
}

const iconSvgProps = {
  fill: "none" as const,
  strokeWidth: 1,
  stroke: "currentColor",
  strokeLinecap: "square" as const,
  "aria-hidden": true as const,
}

// Tile 1 — phone handset
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

// Tile 2 — paper plane: send/outbound glyph, distinct from phone handset at any size
function IconChat({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...iconSvgProps}>
      <path strokeLinejoin="round" d="M22 2L11 13" />
      <path strokeLinejoin="round" d="M22 2L15 22L11 13L2 9L22 2Z" />
    </svg>
  )
}

// Tile 3 — envelope: rectangle base + M-shaped fold line across the top
function IconLetter({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...iconSvgProps}>
      <path strokeLinejoin="miter" d="M2 6h20v14H2V6z" />
      <path strokeLinejoin="miter" d="M2 6l10 9 10-9" />
    </svg>
  )
}

type WalletEntry = { chain: string; address: string; explorerHref: string }

export function ConnexionContactPanel({
  voiceUrl,
  messageUrl,
  chatUrl,
  email,
  solanaAddress,
  validatorName,
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
  ].filter((c) => Boolean(c.href))

  const wallets: WalletEntry[] = [
    solanaAddress && {
      chain: "SOL",
      address: solanaAddress,
      explorerHref: `https://solscan.io/account/${solanaAddress}`,
    },
  ].filter(Boolean) as WalletEntry[]

  return (
    <section className="p3-connexion-panel p3-connexion-panel--fit border border-emerald-500/35 bg-neutral-950">
      <nav aria-label="Contact options" className="p3-connexion-panel__nav">
        <ul className="p3-connexion-contact-list m-0 list-none p-0">
          {channels.map((ch) => {
            const Icon = ch.icon
            const href = String(ch.href)
            const newTab = opensInNewTab(href)
            return (
              <li key={ch.id}>
                <a
                  href={ch.href}
                  target={newTab ? "_blank" : undefined}
                  rel={newTab ? "noreferrer" : undefined}
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

      {wallets.length > 0 && (
        <div className="p3-connexion-keys-strip">
          <ul className="p3-connexion-keys-strip__list">
            {wallets.map(({ chain, address, explorerHref }) => (
              <li key={chain}>
                <a
                  href={explorerHref}
                  target="_blank"
                  rel="noreferrer"
                  className="p3-connexion-keys-strip__row"
                  aria-label={`${chain} public address: ${address}`}
                >
                  <span className="p3-connexion-keys-strip__chain">{chain}</span>
                  <span className="p3-connexion-keys-strip__addr">{abbrevAddr(address)}</span>
                </a>
              </li>
            ))}
          </ul>
          {validatorName && (
            <p className="p3-connexion-keys-strip__validator">staked · {validatorName}</p>
          )}
        </div>
      )}

    </section>
  )
}