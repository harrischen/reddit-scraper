/**
 * 证据引文：英文原话 + 中文翻译 + 来源（可点击跳转原帖）
 */

import type { SignalQuote } from "@/src/types";

export function Quote({ q }: { q: SignalQuote }) {
  return (
    <div className="rv-quote">
      <div className="rv-quote-en">"{q.quote_en}"</div>
      <div className="rv-quote-cn">{q.quote_zh}</div>
      <div className="rv-quote-src">
        <a href={q.permalink} target="_blank" rel="noopener noreferrer">
          来源 ↗
        </a>
      </div>
    </div>
  );
}
