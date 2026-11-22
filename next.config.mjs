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
  // The subdomain's home address shows the landing page directly. No redirect, so the
  // address stays short and ad click IDs (?gclid=, UTMs) always reach the page intact.
  // /global-talent-visa-assessment keeps working too.
  async rewrites() {
    return { beforeFiles: [{ source: "/", destination: "/global-talent-visa-assessment" }] };
  },
  async headers() {
    return [
      {
        // Paid-traffic landing page: keep it out of search indexes.
        source: "/global-talent-visa-assessment",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};
export default nextConfig;
