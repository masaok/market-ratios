"use client"

import dynamic from "next/dynamic"

const StockMonitor = dynamic(() => import("@market-ratios/sheet").then((mod) => mod.StockMonitor), {
  ssr: false,
})

export function MonitorLoader() {
  return <StockMonitor />
}
