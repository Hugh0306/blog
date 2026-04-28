const isStaticExport = process.env.STATIC_EXPORT === "1";

/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: ["@luoleiorg/search-core"],
  ...(isStaticExport && { output: "export" }),
  ...(isStaticExport && { typescript: { ignoreBuildErrors: true } }),
  ...(isStaticExport && { eslint: { ignoreDuringBuilds: true } }),
  images: isStaticExport
    ? { unoptimized: true }
    : {
        remotePatterns: [
          { protocol: "https", hostname: "img.is26.com" },
          { protocol: "https", hostname: "c2.is26.com" },
          { protocol: "https", hostname: "static.is26.com" },
        ],
      },
};

export default nextConfig;
