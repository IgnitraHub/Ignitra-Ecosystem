import React, { useEffect, useState } from "react"

interface AssetOverviewPanelProps {
  assetId: string
}

interface AssetOverview {
  name: string
  priceUsd: number
  supply: number
  holders: number
}

type PanelState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; data: AssetOverview }

export const AssetOverviewPanel: React.FC<AssetOverviewPanelProps> = ({ assetId }) => {
  const [state, setState] = useState<PanelState>({ status: "loading" })

  useEffect(() => {
    let cancelled = false

    async function fetchInfo() {
      try {
        setState({ status: "loading" })
        const res = await fetch(`/api/assets/${encodeURIComponent(assetId)}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        })
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`HTTP ${res.status}: ${text}`)
        }
        const json: AssetOverview = await res.json()
        if (!cancelled) {
          setState({ status: "ready", data: json })
        }
      } catch (err: any) {
        if (!cancelled) {
          setState({ status: "error", error: err.message || "Failed to fetch asset overview" })
        }
      }
    }

    fetchInfo()

    return () => {
      cancelled = true
    }
  }, [assetId])

  if (state.status === "loading") {
    return (
      <div className="p-4 bg-gray-50 rounded shadow text-gray-600">
        Loading asset overview...
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <div className="p-4 bg-red-50 rounded shadow text-red-600">
        Failed to load asset overview: {state.error}
      </div>
    )
  }

  const { name, priceUsd, supply, holders } = state.data

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-semibold mb-3">Asset Overview</h2>
      <div className="space-y-1">
        <p><strong>ID:</strong> {assetId}</p>
        <p><strong>Name:</strong> {name}</p>
        <p><strong>Price (USD):</strong> ${priceUsd.toFixed(2)}</p>
        <p><strong>Circulating Supply:</strong> {supply.toLocaleString()}</p>
        <p><strong>Holders:</strong> {holders.toLocaleString()}</p>
      </div>
    </div>
  )
}

export default AssetOverviewPanel
