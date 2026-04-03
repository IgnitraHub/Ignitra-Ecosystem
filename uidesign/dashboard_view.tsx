import React from "react"
import SentimentGauge from "./SentimentGauge"
import AssetOverviewPanel from "./AssetOverviewPanel"
import WhaleTrackerCard from "./WhaleTrackerCard"

/**
 * Dashboard view combining analytics widgets:
 * – SentimentGauge (market sentiment for a given symbol)
 * – AssetOverviewPanel (overview of token/asset)
 * – WhaleTrackerCard (large transaction monitoring)
 */
export const AnalyticsDashboard: React.FC = () => {
  return (
    <main className="p-8 bg-gray-100 min-h-screen">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800">
          Analytics Dashboard
        </h1>
        <p className="text-gray-600 mt-2">
          Monitor token sentiment, asset fundamentals, and whale activity in real time
        </p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1">
          <SentimentGauge symbol="SOL" />
        </div>

        <div className="col-span-1">
          <AssetOverviewPanel assetId="SOL-01" />
        </div>

        <div className="col-span-1">
          <WhaleTrackerCard />
        </div>
      </section>
    </main>
  )
}

export default AnalyticsDashboard
