import { allowlistedIframeFromSrc } from "@/lib/allowlisted-embed";

/**
 * Markdown/react-markdown iframe renderer. Re-checks the allowlist so a
 * crafted `src` never reaches the DOM even if the remark plugin is skipped.
 */
export function AllowlistedIframe({
  src,
  title,
  className,
}: {
  src?: string;
  title?: string;
  className?: string;
}) {
  if (typeof src !== "string") return null;
  const embed = allowlistedIframeFromSrc(src, title);
  if (!embed) return null;
  return (
    <figure className={`p3-allowlisted-embed-frame p3-allowlisted-embed-frame--${embed.kind}`}>
      <iframe
        className={className ?? `p3-allowlisted-embed p3-allowlisted-embed--${embed.kind}`}
        src={embed.src}
        title={embed.title}
        width="100%"
        height={embed.height}
        allow={embed.allow}
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </figure>
  );
}
