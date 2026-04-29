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
  // Native addons and platform-specific packages that cannot be bundled by webpack
  serverExternalPackages: [
    "fluent-ffmpeg",
    "@ffmpeg-installer/ffmpeg",
    "@ffmpeg-installer/darwin-x64",
    "@ffmpeg-installer/linux-x64",
    "@ffmpeg-installer/win32-ia32",
    "@ffmpeg-installer/win32-x64",
    "node-vibrant",
    "check-disk-space",
  ],
  webpack: (config) => {
    // pdf-parse uses a canvas dependency that isn't needed for text extraction
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
