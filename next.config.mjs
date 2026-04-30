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
  // Native addons and packages with CJS/ESM interop issues that must not be bundled by webpack
  serverExternalPackages: [
    // FFmpeg
    "fluent-ffmpeg",
    "@ffmpeg-installer/ffmpeg",
    "@ffmpeg-installer/darwin-x64",
    "@ffmpeg-installer/linux-x64",
    "@ffmpeg-installer/win32-ia32",
    "@ffmpeg-installer/win32-x64",
    // sharp — native C++ image processing (replaces node-vibrant for color extraction)
    "sharp",
    // Disk space util (ESM with node: protocol imports)
    "check-disk-space",
  ],
  webpack: (config) => {
    // pdf-parse uses a canvas dependency that isn't needed for text extraction
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
