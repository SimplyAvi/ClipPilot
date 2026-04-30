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
    // node-vibrant and its full dependency tree (@jimp/custom uses Babel __esModule
    // exports which webpack misresolves as {default:fn} instead of a callable)
    "node-vibrant",
    "@vibrant/color",
    "@vibrant/core",
    "@vibrant/generator",
    "@vibrant/generator-default",
    "@vibrant/image",
    "@vibrant/image-browser",
    "@vibrant/image-node",
    "@vibrant/quantizer",
    "@vibrant/quantizer-mmcq",
    "@vibrant/types",
    "@vibrant/worker",
    "@jimp/bmp",
    "@jimp/core",
    "@jimp/custom",
    "@jimp/gif",
    "@jimp/jpeg",
    "@jimp/plugin-resize",
    "@jimp/png",
    "@jimp/tiff",
    "@jimp/types",
    "@jimp/utils",
    "jimp",
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
