import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";

import { NavVisibilityProvider } from "@/components/layout/NavVisibilityContext";
import { AdTrackingCleanup } from "@/components/layout/AdTrackingCleanup";
import { getNavVisibilityPayload } from "@/lib/nav-visibility";
import { getSovereignIdentity } from "@/lib/sovereign"; // Corrected from @/config/site
import { CANONICAL_SITE_URL } from "@/lib/public-identity";
import { SiteIdentity } from "@/config/site";
import { withBasePath } from "@/lib/base-path";

function metadataBaseUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || SiteIdentity.url;
  try {
    return new URL(raw.endsWith("/") ? raw : `${raw}/`);
  } catch {
    return new URL(`${CANONICAL_SITE_URL}/`);
  }
}

const inter = localFont({
  src: [
    { path: "../../public/fonts/Inter-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/Inter-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/Inter-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/Inter-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export function generateMetadata(): Metadata {
  const { did, addresses, ipfs, domains } = getSovereignIdentity();

  const other: Record<string, string> = {};
  if (did) other["author-did"] = did;
  if (addresses.solana) other["author-solana"] = addresses.solana;
  if (domains.sns) other["author-sns"] = domains.sns;
  if (domains.solSite) other["author-sol-site"] = domains.solSite;
  if (ipfs?.peerId) other["author-ipfs-peer"] = ipfs.peerId;

  return {
    metadataBase: metadataBaseUrl(),
    title: "Transition Insight",
    description: "Planet-III: Human-Centric Governance",
    icons: {
      icon: [{ url: withBasePath("/visuals/icon.png"), type: "image/png" }],
      shortcut: withBasePath("/visuals/icon.png"),
      apple: withBasePath("/visuals/icon.png"),
    },
    other,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const navVisibility = getNavVisibilityPayload();
  const debugBootstrap = `(()=>{const errors=[];addEventListener("error",e=>errors.push({type:"error",message:e.message||"",source:e.filename||""}));addEventListener("unhandledrejection",e=>errors.push({type:"rejection",message:String(e.reason instanceof Error?e.reason.message:e.reason)}));addEventListener("load",()=>{const watermark=document.querySelector(".p3-compass-watermark"),image=watermark?.querySelector("img"),style=watermark?getComputedStyle(watermark):null,rect=watermark?.getBoundingClientRect();navigator.sendBeacon("http://localhost:4174",JSON.stringify({hypothesisId:"A,C,D,E",location:"layout.tsx:bootstrap",message:"window load state",data:{readyState:document.readyState,scriptCount:document.scripts.length,errorCount:errors.length,errors:errors.slice(0,5),watermarkPresent:Boolean(watermark),className:watermark?.className||null,width:rect?.width||0,height:rect?.height||0,left:rect?.left||0,top:rect?.top||0,opacity:style?.opacity||null,visibility:style?.visibility||null,display:style?.display||null,zIndex:style?.zIndex||null,imageComplete:image?.complete||false,imageNaturalWidth:image?.naturalWidth||0,imageSrc:image?.getAttribute("src")||null},timestamp:Date.now()}))},{once:true})})()`;

  return (
    <html lang="en" className={`bg-black ${inter.variable}`}>
      <head>
        {/* #region agent log */}
        <script dangerouslySetInnerHTML={{ __html: debugBootstrap }} />
        {/* #endregion */}
      </head>
      <body className={`${inter.className} bg-black text-white antialiased`}>
        <NavVisibilityProvider value={navVisibility}>
          {children}
        </NavVisibilityProvider>
        <AdTrackingCleanup />
        <Script
          defer
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "c4b3d006fe4b4c56bf2bbf3334b764ea"}'
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}