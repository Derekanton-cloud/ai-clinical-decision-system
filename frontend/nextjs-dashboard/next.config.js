/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_URL;
const nextConfig = {
  async rewrites() {
    if (!backendUrl) return [];
    return [{ source: "/api/:path*", destination: `${backendUrl.replace(/\/$/, "")}/api/:path*` }];
  },
};

module.exports = nextConfig;
