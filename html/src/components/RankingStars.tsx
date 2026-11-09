export default function RankingStars({ score, stars = Math.round(score / 10) / 2 }: { score: number; stars?: number }) {
  return (
    <span className="assistant-ranking" role="img" aria-label={`Ranking ${score} su 100, equivalente a ${stars} stelle su 5`}>
      <span className="assistant-stars" aria-hidden="true">
        <span>★★★★★</span>
        <span className="assistant-stars-fill" style={{ width: `${Math.max(0, Math.min(100, (stars / 5) * 100))}%` }}>★★★★★</span>
      </span>
      <strong>{score}/100</strong>
    </span>
  )
}
