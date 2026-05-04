const webpack = require("webpack");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@recur/sdk", "@recur/solana-client"],

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: require.resolve("crypto-browserify"),
        stream: require.resolve("stream-browserify"),
        buffer: require.resolve("buffer"),
        process: require.resolve("process/browser"),
        vm: false,
        fs: false,
        path: false,
      };
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ["buffer", "Buffer"],
          process: ["process/browser"],
        }),
      );
    }
    return config;
  },
};

module.exports = nextConfig;
