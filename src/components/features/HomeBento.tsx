import { BentoContainer } from '@/components/bento/BentoContainer';
import { BentoGrid } from '@/components/bento/BentoGrid';

export function HomeBento() {
  return (
    <BentoContainer>
      <p className="p3-home-lede">
        An inquiry into intelligence, identity and capital — and the structures through which we live together.
      </p>
      <BentoGrid />
    </BentoContainer>
  );
}
