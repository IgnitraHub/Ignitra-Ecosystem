import React from "react"

interface MarketSentimentWidgetProps {
  sentimentScore: number // value from 0 to 100
  trend: "Bullish" | "Bearish" | "Neutral"
  dominantToken: string
  totalVolume24h: number
}

const getSentimentColor = (score: number): string => {
  if (score >= 70) return "bg-green-500"
  if (score >= 40) return "bg-yellow-500"
  return "bg-red-500"
}

const getSentimentLabel = (score: number): string => {
  if (score >= 70) return "Positive"
  if (score >= 40) return "Neutral"
  return "Negative"
}

export const MarketSentimentWidget: React.FC<MarketSentimentWidgetProps> = ({
  sentimentScore,
  trend,
  dominantToken,
  totalVolume24h,
}) => {
  return (
    <div
      className="rounded-xl shadow-md bg-white p-6 flex flex-col gap-4"
      role="region"
      aria-label="Market sentiment analysis"
    >
      <h3 className="text-lg font-semibold text-gray-800">
        Market Sentiment
      </h3>

      <div className="flex items-center gap-6">
        {/* Sentiment circle */}
        <div
          className={`flex items-center justify-center rounded-full w-20 h-20 text-white font-bold text-lg ${getSentimentColor(
            sentimentScore
          )}`}
          aria-label={`Sentiment score ${sentimentScore} out of 100`}
        >
          {sentimentScore}%
        </div>

        {/* Details list */}
        <ul className="text-sm text-gray-700 space-y-2">
          <li>
            <strong>Trend:</strong> {trend}
          </li>
          <li>
            <strong>Dominant Token:</strong> {dominantToken}
          </li>
          <li>
            <strong>24h Volume:</strong>{" "}
            ${totalVolume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </li>
          <li className="text-gray-500 italic">
            Sentiment Label: {getSentimentLabel(sentimentScore)}
          </li>
        </ul>
      </div>
    </div>
  )
}

export default MarketSentimentWidget
