/**
 * VOC 决策看板根组件：主题状态 + header + 指标 + tabs + 面板 + footer
 */

import { useState } from "react";
import type { VocReport } from "@/src/types";
import { DashboardHeader } from "./DashboardHeader";
import { MetricsBar } from "./MetricsBar";
import { DashboardTabs, type TabKey } from "./DashboardTabs";
import { OverviewPanel } from "./OverviewPanel";
import { SignalsPanel } from "./SignalsPanel";
import { CompetitionPanel } from "./CompetitionPanel";
import { ShortlistPanel } from "./ShortlistPanel";

export function Dashboard({ report }: { report: VocReport }) {
  const [tab, setTab] = useState<TabKey>("overview");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  return (
    <div className="rv-app" data-theme={theme}>
      <DashboardHeader
        report={report}
        theme={theme}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
      />
      <MetricsBar metrics={report.metrics} />
      <DashboardTabs tab={tab} onTab={setTab} />

      {tab === "overview" && <OverviewPanel signals={report.signals} />}
      {tab === "signals" && <SignalsPanel signals={report.signals} />}
      {tab === "competition" && <CompetitionPanel signals={report.signals} />}
      {tab === "shortlist" && <ShortlistPanel signals={report.signals} />}

      <footer className="rv-footer">
        机会分公式：Opportunity Score = Importance + max(Importance − Satisfaction, 0)，区间 0–20，得分越高代表"用户越在意、现有方案越没满足"，即越值得切入。
      </footer>
    </div>
  );
}
