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
  // Next.js 14 uses experimental.serverComponentsExternalPackages
  // (renamed to serverExternalPackages in Next.js 15)
  experimental: {
    serverComponentsExternalPackages: [
      // FFmpeg
      "fluent-ffmpeg",
      "@ffmpeg-installer/ffmpeg",
      "@ffmpeg-installer/darwin-x64",
      "@ffmpeg-installer/linux-x64",
      "@ffmpeg-installer/win32-ia32",
      "@ffmpeg-installer/win32-x64",
      // sharp — native C++ image processing
      "sharp",
      // Disk space util (ESM with node: protocol imports)
      "check-disk-space",
    ],
  },
  webpack: (config) => {
    // pdf-parse uses a canvas dependency that isn't needed for text extraction
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
