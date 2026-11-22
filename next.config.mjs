/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Photos in /public/photos are already resized and compressed (WebP), so they are
    // served as static files. No runtime image optimiser to configure or to fail.
    unoptimized: true,
  },
  experimental: { optimizePackageImports: ["lucide-react"] },
  async headers() {
    return [
      {
        // Paid-traffic landing page: keep it out of search indexes.
        source: "/global-talent-visa-assessment",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};
export default nextConfig;
