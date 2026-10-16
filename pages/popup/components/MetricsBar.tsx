/**
 * 顶部指标卡：抓取样本 / 有效样本 / 需求信号 / 高机会需求
 */

import type { VocMetrics } from "@/src/types";

export function MetricsBar({ metrics }: { metrics: VocMetrics }) {
  const items = [
    { label: "抓取样本", value: metrics.scraped, hint: "帖子 / 评论原始量", highlight: false },
    { label: "有效样本", value: metrics.valid, hint: "剔除跑题与推广后", highlight: false },
    { label: "需求信号", value: metrics.signals, hint: "聚类后的独立需求", highlight: false },
    { label: "高机会需求", value: metrics.top_opportunities, hint: "机会分 ≥ 12 的切入点", highlight: true },
  ];
  return (
    <div className="rv-metrics">
      {items.map((it) => (
        <div className="rv-metric" key={it.label}>
          <div className="rv-metric-label">{it.label}</div>
          <div className="rv-metric-value" style={it.highlight ? { color: "var(--red)" } : undefined}>
            {it.value}
          </div>
          <div className="rv-metric-hint">{it.hint}</div>
        </div>
      ))}
    </div>
  );
}
