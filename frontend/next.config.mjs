/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: the dashboard compiles to plain HTML/JS in /out, which the
  // FastAPI backend serves directly (no Node.js needed at runtime) and which
  // Vercel/Netlify/Cloudflare Pages/GitHub Pages can host for free.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
};
export default nextConfig;
