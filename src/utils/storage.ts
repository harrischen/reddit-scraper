/**
 * 配置持久化：读写 chrome.storage.local
 *
 * 存储内容分五类：
 * - api：AI 服务的 baseUrl / apiKey / model
 * - task：抓取参数（子版、模式、关键词、数量、评论上限）
 * - pending：一次性标记，弹窗点击「开始抓取」后置 true，标签页读取后清除，
 *   用于实现「弹窗触发 → 标签页自动抓取」的联动（AI 分析永远手动触发）
 * - fetched_data：抓取完成的原始数据（posts 含评论），支撑「数据预览」与关页恢复
 * - voc_report：AI 分析完成的报告，重开标签页可直接查看
 */

import type { ApiSettings, RedditPostRow, TaskConfig, VocReport } from "@/src/types";

/** storage 里的 key 常量，集中管理避免手写字符串出错 */
const STORAGE_KEYS = {
  api: "api_settings",
  task: "task_config",
  pending: "pending_task",
  posts: "fetched_data",
  report: "voc_report",
} as const;

/**
 * API 配置的默认值。
 * 优先级：浏览器已保存的值 > 构建时注入的 env 默认值 > 此处硬编码默认值。
 * env 通过 Vite 的 import.meta.env 注入（见 .env.example / .env.local）。
 */
const DEFAULT_API: ApiSettings = {
  baseUrl: import.meta.env.VITE_DEFAULT_BASE_URL || "https://api.deepseek.com",
  apiKey: import.meta.env.VITE_DEFAULT_API_KEY || "",
  model: import.meta.env.VITE_DEFAULT_MODEL || "deepseek-flash",
};

/** 读取 API 设置，未保存的字段用默认值兜底 */
export async function getApiSettings(): Promise<ApiSettings> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.api);
  const saved = data[STORAGE_KEYS.api] as Partial<ApiSettings> | undefined;
  return { ...DEFAULT_API, ...(saved ?? {}) };
}

export async function saveApiSettings(settings: ApiSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.api]: settings });
}

/** 读取抓取任务配置，未保存的字段用默认值兜底 */
export async function getTaskConfig(): Promise<TaskConfig> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.task);
  const saved = data[STORAGE_KEYS.task] as Partial<TaskConfig> | undefined;
  return {
    subreddit: "",
    mode: "new",
    keyword: "",
    limit: 50,
    maxComments: 500,
    ...(saved ?? {}),
  };
}

export async function saveTaskConfig(config: TaskConfig): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.task]: config });
}

/** 置 pending 标记：弹窗点击「开始抓取」时调用 */
export async function setPendingTask(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.pending]: true });
}

/** 读取并清除 pending 标记：标签页打开时调用，若为 true 则自动抓取 */
export async function consumePendingTask(): Promise<boolean> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.pending);
  const pending = data[STORAGE_KEYS.pending] === true;
  if (pending) {
    await chrome.storage.local.remove(STORAGE_KEYS.pending);
  }
  return pending;
}

// ===== 抓取数据与报告的落盘（关页恢复 / 稍后再分析） =====

/** 保存抓取结果（posts 含评论，可能数 MB，仅在整段抓取完成后调用一次） */
export async function saveFetchedData(posts: RedditPostRow[]): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.posts]: posts });
  } catch (err) {
    throw new Error(
      `抓取结果写入本地存储失败：${(err as Error).message}（数据仍在本次页面中可用）`
    );
  }
}

/** 读取上次抓取的数据，没有则返回 null */
export async function getFetchedData(): Promise<RedditPostRow[] | null> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.posts);
  const posts = data[STORAGE_KEYS.posts] as RedditPostRow[] | undefined;
  return Array.isArray(posts) && posts.length > 0 ? posts : null;
}

export async function clearFetchedData(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.posts);
}

/** 保存 AI 分析报告 */
export async function saveReport(report: VocReport): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.report]: report });
  } catch (err) {
    throw new Error(`报告写入本地存储失败：${(err as Error).message}`);
  }
}

/** 读取上次的分析报告，没有则返回 null */
export async function getReport(): Promise<VocReport | null> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.report);
  return (data[STORAGE_KEYS.report] as VocReport | undefined) ?? null;
}

export async function clearReport(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.report);
}

/** 清空本次会话数据（抓取数据 + 报告），「重新开始」时调用 */
export async function clearSessionData(): Promise<void> {
  await Promise.all([clearFetchedData(), clearReport()]);
}
