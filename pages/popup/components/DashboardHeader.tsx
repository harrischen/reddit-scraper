/**
 * 顶部 header：标题 + 副标题 + chips（品类/市场/数据源）
 */

import type { VocReport } from "@/src/types";

export function DashboardHeader({ report }: { report: VocReport }) {
  return (
    <header className="rv-header">
      <div>
        <h1 className="rv-h1">出海选品 · VOC 决策看板</h1>
        <div className="rv-header-sub">把客户原话转化为可排序、可回查、可执行的选品机会</div>
        <div className="rv-chips">
          <span className="rv-chip">品类：{report.category}</span>
          <span className="rv-chip">目标市场：{report.market}</span>
          <span className="rv-chip">数据源：{report.platform}</span>
        </div>
      </div>
    </header>
  );
}
