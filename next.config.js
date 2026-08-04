const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  output: process.env.NODE_ENV === "production" ? "export" : undefined,
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
