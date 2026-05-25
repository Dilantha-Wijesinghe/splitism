/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === "development";

const nextConfig = {
  async headers() {
    const scriptSrc = isDev
      ? "'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'"
      : "'self' 'unsafe-inline' 'wasm-unsafe-eval'";

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src ${scriptSrc}; object-src 'none'; base-uri 'self'`
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "X-Frame-Options",
            value: "DENY"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
