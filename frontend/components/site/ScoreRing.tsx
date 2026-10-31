"use client";

export default function ScoreRing({ score, size = 150 }: { score: number; size?: number }) {
  const r = size / 2 - 10, c = 2 * Math.PI * r;
  const col = score >= 80 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f43f5e";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Safety score ${score} of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.08)" strokeWidth="12" fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={col} strokeWidth="12" fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .8s" }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={size / 3.4} fontWeight="900">{score}</text>
    </svg>
  );
}
