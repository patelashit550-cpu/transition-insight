import { HomeBento } from "@/components/features/HomeBento";

export default function Home() {
  return (
    <div className="p3-landing-home flex flex-1 flex-col justify-start w-full relative">
      <div className="relative w-full" style={{ zIndex: 1 }}>
        <HomeBento />
      </div>
    </div>
  );
}
