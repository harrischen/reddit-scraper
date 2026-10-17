/**
 * 左侧固定表单区：步骤导航 + 抓取参数 + AI 设置 + 主操作按钮
 * 两步：① 配置&预览（内部流转：配置→抓取中→预览）→ ② AI 报告
 * 主按钮：配置→「① 开始抓取」；抓取后→「② 开始 AI 分析」+「① 重新抓取」；报告→「重新开始」
 * 弹窗形态下即全部内容；标签页形态下是左栏。
 */

import type { AnalysisState } from "@/src/hooks/useAnalysisRunner";
import { PROVIDER_PRESETS, type ApiSettings, type Mode, type TaskConfig } from "@/src/types";
import { Stepper } from "./components/Stepper";

type Stage = AnalysisState["stage"];

/** 帖子数量可选值（以 10 递增） */
const LIMIT_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
/** 每帖评论上限可选值（以 100 递增，Reddit 单次最多返回 500 条） */
const COMMENT_OPTIONS = [100, 200, 300, 400, 500];

/** 抓取参数校验：非搜索模式必填子版名；搜索模式必填关键词。返回各字段错误文案。 */
function validateTask(task: TaskConfig): { subreddit?: string; keyword?: string } {
  if (task.mode === "search") {
    if (!task.keyword.trim()) return { keyword: "请输入搜索关键词" };
    return {};
  }
  if (!task.subreddit.trim()) return { subreddit: "请输入子版名，如 HomeDecorating" };
  return {};
}

/** AI 设置校验：分析前必须三项齐备。返回各字段错误文案。 */
function validateApi(api: ApiSettings): { baseUrl?: string; apiKey?: string; model?: string } {
  const errors: { baseUrl?: string; apiKey?: string; model?: string } = {};
  if (!api.baseUrl.trim()) errors.baseUrl = "请输入 Base URL";
  if (!api.apiKey.trim()) errors.apiKey = "请输入 API Key";
  if (!api.model.trim()) errors.model = "请输入模型名";
  return errors;
}

interface Props {
  api: ApiSettings;
  task: TaskConfig;
  onApiChange: (next: ApiSettings) => void;
  onTaskChange: (next: TaskConfig) => void;
  onFetch: () => void;
  onAnalyze: () => void;
  onReset: () => void;
  onBack?: () => void;
  ready: boolean;
  stage: Stage;
  errorFrom?: "fetch" | "analyze";
  step: 1 | 2;
  isTab: boolean;
}

export default function Sidebar({
  api,
  task,
  onApiChange,
  onTaskChange,
  onFetch,
  onAnalyze,
  onReset,
  onBack,
  ready,
  stage,
  errorFrom,
  step,
  isTab,
}: Props) {
  const busy = stage === "fetching" || stage === "analyzing";
  const errors = validateTask(task);
  const formInvalid = Boolean(errors.subreddit || errors.keyword);
  const apiErrors = validateApi(api);
  const apiInvalid = Boolean(apiErrors.baseUrl || apiErrors.apiKey || apiErrors.model);
  /** 当前 baseUrl 命中的预设服务商；未命中则为自定义 */
  const preset = PROVIDER_PRESETS.find((p) => p.baseUrl === api.baseUrl);

  const primary: { label: string; action: (() => void) | null; secondary?: boolean } = (() => {
    switch (stage) {
      case "config":
        return { label: "① 开始抓取", action: onFetch };
      case "fetching":
        return { label: "抓取中…", action: null };
      case "fetched":
        return { label: "② 开始 AI 分析", action: onAnalyze };
      case "analyzing":
        return { label: "分析中…", action: null };
      case "done":
        return { label: "重新开始", action: onReset, secondary: true };
      case "error":
        return errorFrom === "analyze"
          ? { label: "重试 AI 分析", action: onAnalyze }
          : { label: "重试抓取", action: onFetch };
    }
  })();

  return (
    <div className="sidebar">
      <div className="toolbar">
        <h1>Reddit 数据抓取</h1>
        {!isTab && (
          <button
            className="open-tab"
            title="在独立标签页打开"
            onClick={() =>
              chrome.tabs.create({ url: chrome.runtime.getURL("pages/popup/popup.html?tab=1") })
            }
          >
            ↗
          </button>
        )}
      </div>

      {isTab && <Stepper current={step} onBack={onBack} />}

      {/* 步骤1：抓取参数 */}
      <div className="form-section">
        <div className="form-section-title">抓取参数</div>
        <label>
          子版名（不含 r/，关键词全站搜索时可留空）
          <input
            type="text"
            placeholder="例如 HomeDecorating"
            value={task.subreddit}
            className={errors.subreddit ? "input-error" : undefined}
            onChange={(e) => onTaskChange({ ...task, subreddit: e.target.value })}
          />
          {errors.subreddit && <span className="field-error">{errors.subreddit}</span>}
        </label>

        <label>
          排序 / 模式
          <select
            value={task.mode}
            onChange={(e) => onTaskChange({ ...task, mode: e.target.value as Mode })}
          >
            <option value="new">最新 new</option>
            <option value="hot">热门 hot</option>
            <option value="rising">上升 rising</option>
            <option value="search">关键词搜索</option>
          </select>
        </label>

        {/* 仅「关键词搜索」模式显示 */}
        {task.mode === "search" && (
          <label>
            关键词
            <input
              type="text"
              placeholder="例如 storage bin"
              value={task.keyword}
              className={errors.keyword ? "input-error" : undefined}
              onChange={(e) => onTaskChange({ ...task, keyword: e.target.value })}
            />
            {errors.keyword && <span className="field-error">{errors.keyword}</span>}
          </label>
        )}

        <label>
          帖子数量（以 10 递增）
          <select
            value={task.limit}
            onChange={(e) => onTaskChange({ ...task, limit: parseInt(e.target.value, 10) })}
          >
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} 篇
              </option>
            ))}
          </select>
        </label>

        <label>
          每帖评论上限（Reddit 单次最多返回 500 条）
          <select
            value={task.maxComments}
            onChange={(e) => onTaskChange({ ...task, maxComments: parseInt(e.target.value, 10) })}
          >
            {COMMENT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} 条
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* AI 设置：抓取完成后出现，分析前配置；失焦自动保存 */}
      {stage === "fetched" && (
        <details className="form-section" open>
          <summary>AI 设置（分析前配置）</summary>
          <label>
            服务商
            <select
              value={preset ? preset.baseUrl : "custom"}
              onChange={(e) => {
                const p = PROVIDER_PRESETS.find((pp) => pp.baseUrl === e.target.value);
                onApiChange(
                  p
                    ? { ...api, baseUrl: p.baseUrl, model: p.models[0] }
                    : { ...api, baseUrl: "", model: "" }
                );
              }}
            >
              {PROVIDER_PRESETS.map((p) => (
                <option key={p.baseUrl} value={p.baseUrl}>
                  {p.name}
                </option>
              ))}
              <option value="custom">自定义…</option>
            </select>
          </label>

          {!preset && (
            <label>
              Base URL
              <input
                type="text"
                placeholder="https://api.openai.com/v1"
                value={api.baseUrl}
                className={apiErrors.baseUrl ? "input-error" : undefined}
                onChange={(e) => onApiChange({ ...api, baseUrl: e.target.value })}
              />
              {apiErrors.baseUrl && <span className="field-error">{apiErrors.baseUrl}</span>}
            </label>
          )}

          <label>
            API Key
            <input
              type="password"
              placeholder="sk-..."
              value={api.apiKey}
              className={apiErrors.apiKey ? "input-error" : undefined}
              onChange={(e) => onApiChange({ ...api, apiKey: e.target.value })}
            />
            {apiErrors.apiKey && <span className="field-error">{apiErrors.apiKey}</span>}
          </label>

          <label>
            模型
            {preset ? (
              <select
                value={api.model}
                onChange={(e) => onApiChange({ ...api, model: e.target.value })}
              >
                {preset.models.includes(api.model) ? null : (
                  <option value={api.model}>{api.model}</option>
                )}
                {preset.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="gpt-4o-mini"
                value={api.model}
                className={apiErrors.model ? "input-error" : undefined}
                onChange={(e) => onApiChange({ ...api, model: e.target.value })}
              />
            )}
            {!preset && apiErrors.model && <span className="field-error">{apiErrors.model}</span>}
          </label>
        </details>
      )}

      {primary.action ? (
        <button
          className={primary.secondary ? "secondary" : ""}
          onClick={primary.action}
          disabled={
            !ready ||
            busy ||
            (stage === "config" && formInvalid) ||
            (stage === "fetched" && apiInvalid)
          }
        >
          {primary.label}
        </button>
      ) : (
        <button disabled>{primary.label}</button>
      )}

      {/* 抓取完成后，「开始抓取」变为「重新抓取」 */}
      {stage === "fetched" && (
        <button className="secondary" onClick={onFetch} disabled={!ready || busy || formInvalid}>
          ① 重新抓取（覆盖当前数据）
        </button>
      )}

      {/* 报告阶段可回退到数据预览 */}
      {stage === "done" && onBack && (
        <button className="secondary" onClick={onBack} disabled={!ready || busy}>
          ← 回数据预览
        </button>
      )}

      {isTab && stage === "fetching" && (
        <div className="status-hint">抓取期间请保持本页打开，关闭将丢失本次抓取进度。</div>
      )}
    </div>
  );
}
