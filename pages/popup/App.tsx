/**
 * 根组件：两种形态共用一套代码
 *
 * 1. 弹窗（popup）：窄窗口，只作「启动器」——填配置、点「开始抓取」后打开标签页
 * 2. 标签页（tab，URL 带 ?tab=1）：左右分栏工作台——左固定表单（带步骤导航），
 *    右侧按阶段渲染：引导空态 / 抓取进度 / 数据预览 / 分析进度 / 报告
 *
 * 长任务（抓评论 + AI 分析耗时 5-8 分钟）不能在弹窗跑（弹窗失焦即销毁），
 * 所以：弹窗点「开始抓取」→ 存配置 + 置 pending 标记 → 打开标签页自动抓取。
 * 抓取完成后停在「数据预览」，AI 分析由用户确认数据后手动触发。
 */

import { useCallback, useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import ReportPanel from "./ReportPanel";
import DataPreviewPanel from "./components/DataPreviewPanel";
import { ProgressPanel } from "./components/ProgressPanel";
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

/** 状态机 → Stepper 当前步骤（1 配置&预览 / 2 AI 报告） */
function currentStep(stage: string, errorFrom?: "fetch" | "analyze"): 1 | 2 {
  switch (stage) {
    case "config":
    case "fetching":
    case "fetched":
      return 1;
    case "analyzing":
    case "done":
      return 2;
    default:
      // 抓取失败回到步骤1；分析失败停在步骤2
      return errorFrom === "analyze" ? 2 : 1;
  }
}

export default function App() {
  const { state, restore, fetchData, startAnalysis, reset, gotoStep } = useAnalysisRunner();

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

  // 初始化：恢复配置与上次会话数据；标签页模式下消费 pending 标记并自动抓取
  useEffect(() => {
    void (async () => {
      const [savedApi, savedTask] = await Promise.all([getApiSettings(), getTaskConfig()]);
      setApi(savedApi);
      setTask(savedTask);
      await restore();
      setReady(true);
      if (isTab && (await consumePendingTask())) {
        void fetchData(savedTask);
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

  /** 「开始抓取」：弹窗置 pending 后开标签页；标签页直接抓取 */
  const onFetch = useCallback(async () => {
    await saveApiSettings(api);
    await saveTaskConfig(task);
    if (!isTab) {
      await setPendingTask();
      chrome.tabs.create({ url: chrome.runtime.getURL("pages/popup/popup.html?tab=1") });
    } else {
      void fetchData(task);
    }
  }, [api, task, fetchData]);

  /** 「开始 AI 分析」：仅在标签页可用（长任务），数据来自已落盘的抓取结果 */
  const onAnalyze = useCallback(async () => {
    await saveApiSettings(api);
    void startAnalysis(api, task);
  }, [api, task, startAnalysis]);

  const status =
    state.stage === "fetching" || state.stage === "analyzing"
      ? state.progress
      : state.stage === "error"
        ? state.message
        : "";

  const step = currentStep(state.stage, state.stage === "error" ? state.from : undefined);

  const running = state.stage === "fetching" || state.stage === "analyzing";
  // 上一步：从步骤2回到步骤1（有数据则回到预览，无数据回到配置）
  const onBack = step === 2 && !running ? () => void gotoStep(1) : undefined;

  return (
    <div className="layout">
      <Sidebar
        api={api}
        task={task}
        onApiChange={onApiChange}
        onTaskChange={onTaskChange}
        onFetch={() => void onFetch()}
        onAnalyze={() => void onAnalyze()}
        onReset={() => void reset()}
        onBack={onBack}
        ready={ready}
        stage={state.stage}
        errorFrom={state.stage === "error" ? state.from : undefined}
        step={step}
        isTab={isTab}
      />
      {isTab && (
        <div className="main">
          {state.stage === "config" && (
            <div className="rv-empty">
              <h2>从 Reddit 用户原话里找选品机会</h2>
              <p>
                两步走：① 填好抓取参数并抓取数据、预览确认 → ② AI 分析生成选品决策看板。
                抓取期间请保持本页打开（约 5-8 分钟，取决于数量）。
              </p>
              <p className="rv-empty-note">填好左侧配置后点「开始抓取」，数据会显示在这里。</p>
            </div>
          )}
          {(state.stage === "fetching" || state.stage === "analyzing") && (
            <ProgressPanel progress={status} analyzing={state.stage === "analyzing"} />
          )}
          {state.stage === "fetched" && (
            <DataPreviewPanel posts={state.posts} task={task} />
          )}
          {state.stage === "error" && (
            <div className="rv-empty rv-error">
              <h2>出错了</h2>
              <p>{state.message}</p>
              <p className="rv-empty-note">
                {state.from === "fetch"
                  ? "可在左侧调整参数后重试抓取"
                  : "可重试分析，或回数据预览检查数据"}
              </p>
            </div>
          )}
          {state.stage === "done" && <ReportPanel state={state} task={task} />}
        </div>
      )}
    </div>
  );
}
