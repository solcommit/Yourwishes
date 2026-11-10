import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// Permit only this machine's private LAN addresses, not arbitrary origins.
// Next also permits localhost and the hostname used to start the server.
const lanHosts = Object.values(networkInterfaces()).flat().filter((entry) =>
  entry && !entry.internal && entry.family === "IPv4" &&
  /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry.address),
).map((entry) => entry!.address);

const nextConfig: NextConfig = {
  // Keep isolated fixture-backed audit builds separate from normal dev output.
  distDir: process.env.YOURWISHES_AUDIT_DIST_DIR || ".next",
  allowedDevOrigins: lanHosts,
  async headers(){return [{source:"/sw.js",headers:[
    {key:"Content-Type",value:"application/javascript; charset=utf-8"},
    {key:"Cache-Control",value:"no-cache, no-store, must-revalidate"},
    {key:"Service-Worker-Allowed",value:"/"},
    {key:"X-Content-Type-Options",value:"nosniff"},
    {key:"Content-Security-Policy",value:"default-src 'self'; script-src 'self'"},
  ]}];},
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
