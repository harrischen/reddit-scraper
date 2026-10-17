/**
 * 步骤3：报告区（仅标签页显示）
 * 顶部操作栏（复制 Markdown / 下载报告 .md）+ 决策看板
 * 原始 CSV 下载已移到「数据预览」阶段（DataPreviewPanel）
 */

import { useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { copyText } from "@/src/utils/clipboard";
import { downloadFile, filePrefix } from "@/src/utils/download";
import { toPostsCsv, toCommentsCsv } from "@/src/utils/csv";
import type { AnalysisState } from "@/src/hooks/useAnalysisRunner";
import type { TaskConfig } from "@/src/types";

interface Props {
  state: Extract<AnalysisState, { stage: "done" }>;
  task: TaskConfig;
}

export default function ReportPanel({ state, task }: Props) {
  const [toast, setToast] = useState("");
  const { report, markdown, posts } = state;

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  return (
    <>
      <div className="report-actions">
        <button
          className="secondary"
          onClick={async () => {
            await copyText(markdown);
            notify("已复制 Markdown 到剪贴板");
          }}
        >
          复制 Markdown
        </button>
        <button
          className="secondary"
          disabled={posts.length === 0}
          onClick={() => {
            downloadFile(`${filePrefix(task)}_posts.csv`, toPostsCsv(posts), "text/csv");
            downloadFile(`${filePrefix(task)}_comments.csv`, toCommentsCsv(posts), "text/csv");
            notify("已下载原始 CSV（posts + comments）");
          }}
        >
          下载原始 CSV
        </button>
        <button
          className="secondary"
          onClick={() => {
            downloadFile(`${filePrefix(task)}_voc_report.md`, markdown, "text/markdown");
            notify("已下载 VOC 报告 .md");
          }}
        >
          下载 VOC 报告
        </button>
        {toast && <span className="rv-toast">{toast}</span>}
      </div>

      <Dashboard report={report} />
    </>
  );
}
