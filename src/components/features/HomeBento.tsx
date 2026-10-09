import { BentoContainer } from '@/components/bento/BentoContainer';
import { BentoGrid } from '@/components/bento/BentoGrid';

export function HomeBento() {
  return (
    <BentoContainer>
      {/* Lede in Ashit's handwriting (public/identity/handwriting/). The sentence stays as
          visually hidden text for screen readers and search; the drawings are decorative. */}
      <p className="p3-home-lede p3-home-lede--hand">
        <span className="p3-hw-sr">
          An inquiry into intelligence, identity and capital — and the structures through which we live and come together.
        </span>
        <span className="p3-hw p3-hw--wide" aria-hidden="true" />
        <span className="p3-hw p3-hw--narrow" aria-hidden="true" />
      </p>
      <BentoGrid />
      {/* Signature (public/identity/handwriting/signature/ash.svg), drawn as a mask over
          currentColor like the lede: grey at rest, white on hover. */}
      <div className="p3-home-sig">
        <span className="p3-sig" role="img" aria-label="Ash" />
      </div>
    </BentoContainer>
  );
}
