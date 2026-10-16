/**
 * 报告渲染层：把 VocReport（需求信号看板）渲染成 Markdown 文本
 *
 * 用于「复制 Markdown」和「下载 .md」。
 * 可视化看板见 React 渲染层，Markdown 版是便携降级格式。
 */

import { OPPORTUNITY_THRESHOLD, type SignalQuote, type VocReport } from "@/src/types";

/** 转义 Markdown 特殊字符 */
function escapeMd(text: string): string {
  return text.replace(/[|\\]/g, "\\$&");
}

/** 一条证据的三要素：英文原话 + 中文翻译 + 来源链接 */
function renderQuote(q: SignalQuote): string[] {
  return [`> "${escapeMd(q.quote_en)}"`, `> ${escapeMd(q.quote_zh)}`, `> [来源](${q.permalink})`];
}

export function toMarkdown(report: VocReport): string {
  const lines: string[] = [];
  const m = report.metrics;

  lines.push("# Reddit VOC 选品决策看板");
  lines.push("");
  lines.push(`- 品类：${escapeMd(report.category)}`);
  lines.push(`- 目标市场：${escapeMd(report.market)} · 数据源：${escapeMd(report.platform)}`);
  lines.push(
    `- 指标：抓取样本 ${m.scraped} · 有效样本 ${m.valid} · 需求信号 ${m.signals} · 高机会需求 ${m.top_opportunities}`
  );
  lines.push(`- 生成时间：${new Date(report.generated_at).toLocaleString("zh-CN")}`);
  lines.push("");

  lines.push(
    `> 机会分公式：Opportunity = Importance + max(Importance − Satisfaction, 0)，区间 0-20，≥ ${OPPORTUNITY_THRESHOLD} 为高机会需求。`
  );
  lines.push("");

  // 需求信号（已按机会分降序）
  lines.push("## 需求信号");
  lines.push("");
  for (const s of report.signals) {
    lines.push(`### ${s.id} ${escapeMd(s.name)}（机会分 ${s.opportunity}）`);
    lines.push("");
    lines.push(
      `- 提及 ${s.freq} 次 · 重要性 ${s.importance}/10 · 满意度 ${s.satisfaction}/10 · 付费意愿 ${escapeMd(s.willingness)} · 竞争度 ${escapeMd(s.competition)}`
    );
    if (s.current) lines.push(`- 现有解决办法：${escapeMd(s.current)}`);
    if (s.flaw) lines.push(`- 方案缺陷：${escapeMd(s.flaw)}`);
    if (s.angle) lines.push(`- 切入角度：${escapeMd(s.angle)}`);
    lines.push("");
    if (s.quotes.length) {
      lines.push("证据原话：");
      for (const q of s.quotes) lines.push(...renderQuote(q));
      lines.push("");
    }
    if (s.cur_quotes.length) {
      lines.push("对现有方案的不满：");
      for (const q of s.cur_quotes) lines.push(...renderQuote(q));
      lines.push("");
    }
  }

  // 选品短名单
  const top = report.signals.slice(0, 3);
  lines.push("## 选品短名单（机会分 Top 3）");
  lines.push("");
  if (top.length === 0) {
    lines.push("_（未发现）_");
  } else {
    for (let i = 0; i < top.length; i++) {
      const s = top[i];
      lines.push(`${i + 1}. **${escapeMd(s.name)}**（机会分 ${s.opportunity}）`);
      if (s.angle) lines.push(`   切入角度：${escapeMd(s.angle)}`);
      lines.push(
        `   提及 ${s.freq} 次 · 满意度 ${s.satisfaction}/10 · 竞争度 ${escapeMd(s.competition)}`
      );
    }
  }
  lines.push("");

  return lines.join("\n");
}
