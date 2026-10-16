/**
 * 根组件：两种形态共用一套代码
 *
 * 1. 弹窗（popup）：窄窗口，只作「启动器」——填配置、点「开始分析」后打开标签页
 * 2. 标签页（tab，URL 带 ?tab=1）：左右分栏工作台——左表单右报告，支持复制/下载
 *
 * 长任务（抓评论 + AI 分析耗时 5-8 分钟）不能在弹窗跑（弹窗失焦即销毁），
 * 所以：弹窗点「开始分析」→ 存配置 + 置 pending 标记 → 打开标签页自动执行。
 */

import { useCallback, useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import ReportPanel from "./ReportPanel";
import { useAnalysisRunner } from "@/src/hooks/useAnalysisRunner";
import {
  consumePendingTask,
  getApiSettings,
  getTaskConfig,
  saveApiSettings,
  saveTaskConfig,
  setPendingTask,
} from "@/src/utils/storage";
import type { ApiSettings, TaskConfig } from "@/src/types";

/** 是否在标签页（而非弹窗）中打开 */
const isTab = new URLSearchParams(location.search).get("tab") === "1";

export default function App() {
  const { state, run } = useAnalysisRunner();

  const [api, setApi] = useState<ApiSettings>({
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  const [task, setTask] = useState<TaskConfig>({
    subreddit: "",
    mode: "new",
    keyword: "",
    limit: 50,
    maxComments: 500,
  });
  /** 配置是否已从 storage 恢复（恢复前禁用按钮，避免用默认值误跑） */
  const [ready, setReady] = useState(false);

  // 初始化：恢复配置；标签页模式下消费 pending 标记并自动执行
  useEffect(() => {
    void (async () => {
      const [savedApi, savedTask] = await Promise.all([getApiSettings(), getTaskConfig()]);
      setApi(savedApi);
      setTask(savedTask);
      setReady(true);
      if (isTab && (await consumePendingTask())) {
        void run(savedApi, savedTask);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** API 设置失焦自动保存，避免用户填完直接关弹窗导致配置丢失 */
  const onApiChange = useCallback((next: ApiSettings) => {
    setApi(next);
    void saveApiSettings(next);
  }, []);

  const onTaskChange = useCallback((next: TaskConfig) => {
    setTask(next);
  }, []);

  /** 「开始分析」：弹窗置 pending 后开标签页；标签页直接执行 */
  const onAnalyze = useCallback(async () => {
    await saveApiSettings(api);
    await saveTaskConfig(task);
    if (!isTab) {
      await setPendingTask();
      chrome.tabs.create({ url: chrome.runtime.getURL("pages/popup/popup.html?tab=1") });
    } else {
      void run(api, task);
    }
  }, [api, task, run]);

  return (
    <div className="layout">
      <Sidebar
        api={api}
        task={task}
        onApiChange={onApiChange}
        onTaskChange={onTaskChange}
        onAnalyze={() => void onAnalyze()}
        ready={ready}
        status={
          state.phase === "running"
            ? state.progress
            : state.phase === "error"
              ? state.message
              : ""
        }
        running={state.phase === "running"}
        isTab={isTab}
      />
      {isTab && <ReportPanel state={state} task={task} />}
    </div>
  );
}
