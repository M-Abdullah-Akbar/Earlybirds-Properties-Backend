const path = require("path");
const nodeExternals = require("webpack-node-externals");
const CopyPlugin = require("copy-webpack-plugin");
const webpack = require("webpack");

module.exports = {
  target: "node",
  mode: "production",
  entry: "./backend/src/server.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "server.js",
    clean: true, // Clean the output directory before emit
  },
  externals: [nodeExternals()], // Exclude node_modules from bundle
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "production"),
    }),
    new CopyPlugin({
      patterns: [
        {
          from: process.env.NODE_ENV === "development" ? "backend/.env" : "backend/.env.production",
          to: ".env",
          toType: "file",
          noErrorOnMissing: true,
        },
        {
          from: "package.json",
          to: "package.json",
        },
        {
          from: "package-lock.json",
          to: "package-lock.json",
          noErrorOnMissing: true,
        },
        {
          from: "backend/src/uploads",
          to: "uploads",
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
  resolve: {
    extensions: [".js", ".json"],
  },
  optimization: {
    minimize: true,
  },
};
