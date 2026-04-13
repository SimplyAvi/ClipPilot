/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  webpack: (config) => {
    // pdf-parse uses a canvas dependency that isn't needed for text extraction
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
