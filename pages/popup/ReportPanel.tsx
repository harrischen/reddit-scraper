/**
 * 右侧报告区（仅标签页显示）：
 * 顶部操作栏（复制 Markdown / 下载 CSV / 下载报告）+ 看板
 */

import { useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { copyText } from "@/src/utils/clipboard";
import { downloadFile, filePrefix } from "@/src/utils/download";
import { toPostsCsv, toCommentsCsv } from "@/src/utils/csv";
import type { AnalysisState } from "@/src/hooks/useAnalysisRunner";
import type { TaskConfig } from "@/src/types";

interface Props {
  state: AnalysisState;
  task: TaskConfig;
}

export default function ReportPanel({ state, task }: Props) {
  const [toast, setToast] = useState("");

  const report = state.phase === "done" ? state.report : null;
  const posts = state.phase === "done" ? state.posts : null;
  const markdown = state.phase === "done" ? state.markdown : "";

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const prefix = () => filePrefix(task);

  return (
    <div className="main">
      <div className="report-actions">
        <button
          className="secondary"
          disabled={!markdown}
          onClick={async () => {
            if (!markdown) return;
            await copyText(markdown);
            notify("已复制 Markdown 到剪贴板");
          }}
        >
          复制 Markdown
        </button>
        <button
          className="secondary"
          disabled={!posts || posts.length === 0}
          onClick={() => {
            if (!posts) return;
            downloadFile(`${prefix()}_posts.csv`, toPostsCsv(posts), "text/csv");
            downloadFile(`${prefix()}_comments.csv`, toCommentsCsv(posts), "text/csv");
            notify("已下载原始 CSV（posts + comments）");
          }}
        >
          下载原始 CSV
        </button>
        <button
          className="secondary"
          disabled={!markdown}
          onClick={() => {
            if (!markdown) return;
            downloadFile(`${prefix()}_voc_report.md`, markdown, "text/markdown");
            notify("已下载 VOC 报告 .md");
          }}
        >
          下载 VOC 报告
        </button>
        {toast && <span className="rv-toast">{toast}</span>}
      </div>

      {report ? (
        <Dashboard report={report} />
      ) : (
        <div className="rv-placeholder">
          {state.phase === "running"
            ? state.progress
            : state.phase === "error"
              ? state.message
              : "填好左侧配置后点「开始分析」，报告会显示在这里"}
        </div>
      )}
    </div>
  );
}
