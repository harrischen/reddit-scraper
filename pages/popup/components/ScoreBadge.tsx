/**
 * 机会分徽章：按分数着色（红 = 高机会 · 琥珀 = 中 · 蓝 = 低）
 */

/** 机会分 → 颜色（对齐设计稿：≥12 红 / ≥9 琥珀 / 其余蓝） */
export function opportunityColor(v: number): string {
  if (v >= 12) return "var(--red)";
  if (v >= 9) return "var(--amber)";
  return "var(--accent)";
}

export function ScoreBadge({ value }: { value: number }) {
  return (
    <span
      className="rv-score-badge"
      style={{ color: opportunityColor(value) }}
    >
      机会分 {value}
    </span>
  );
}
