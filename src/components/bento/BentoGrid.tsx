import { BentoHomeEqualRows } from './BentoHomeEqualRows';
import { getNavVisibilityPayload } from '@/lib/nav-visibility';

export const BentoGrid = () => {
  const visible = getNavVisibilityPayload();
  const visKey = JSON.stringify(visible);

  return <BentoHomeEqualRows key={visKey} visible={visible} />;
};
