import { HomeBento } from "@/components/features/HomeBento";
import { CompassWatermark } from "@/components/features/CompassWatermark";

export default function Home() {
  return (
    <div className="p3-landing-home flex flex-1 flex-col justify-start w-full relative">
      <CompassWatermark />
      <div className="relative w-full" style={{ zIndex: 1 }}>
        <HomeBento />
      </div>
    </div>
  );
}
