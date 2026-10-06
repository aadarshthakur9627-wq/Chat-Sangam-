/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep unpdf's Node/serverless PDF.js internals external on Vercel.
  serverExternalPackages: ["unpdf"],
};

export default nextConfig;
