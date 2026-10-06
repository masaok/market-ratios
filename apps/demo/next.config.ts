import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@market-ratios/quotes", "@market-ratios/sheet"],
}

export default nextConfig
