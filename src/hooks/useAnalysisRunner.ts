/**
 * 分析流程 hook：三阶段状态机（配置 → 抓取 → AI 分析）
 *
 * 阶段可独立触发：抓取完成后停在「数据预览」，由用户确认数据质量后
 * 手动点「开始 AI 分析」（避免拿坏数据白烧 token）。
 *
 * 状态机：
 *   config（步骤1：配置/无数据）
 *     → fetching（抓取中，带进度）
 *     → fetched（步骤2：数据预览，posts 已落盘）
 *     → analyzing（AI 分析中）
 *     → done（步骤3：报告已落盘）
 *   任意阶段可 error（带 from 标记区分是抓取还是分析出错）
 *
 * 数据持久化：抓取完成原子落盘 fetched_data，报告落盘 voc_report，
 * 关闭标签页后重开通过 restore() 恢复到 fetched 或 done。
 */

import { useCallback, useState } from "react";
import { fetchPostsWithComments } from "@/src/utils/reddit";
import { rotateUa, clearUaRule } from "@/src/utils/requestGuard";
import { runAnalysis } from "@/src/utils/analyze";
import { toMarkdown } from "@/src/utils/report";
import {
  clearFetchedData,
  clearReport,
  getFetchedData,
  getReport,
  saveFetchedData,
  saveReport,
} from "@/src/utils/storage";
import type { ApiSettings, RedditPostRow, TaskConfig, VocReport } from "@/src/types";

export type AnalysisState =
  | { stage: "config" }
  | { stage: "fetching"; progress: string }
  | { stage: "fetched"; posts: RedditPostRow[] }
  | { stage: "analyzing"; progress: string; phase: "extract" | "aggregate"; batch: number; batches: number; posts: RedditPostRow[] }
  | { stage: "done"; report: VocReport; markdown: string; posts: RedditPostRow[] }
  | { stage: "error"; message: string; from: "fetch" | "analyze" };

export function useAnalysisRunner() {
  const [state, setState] = useState<AnalysisState>({ stage: "config" });

  /** 挂载时恢复：报告优先（done），其次抓取数据（fetched） */
  const restore = useCallback(async (): Promise<void> => {
    const [report, posts] = await Promise.all([getReport(), getFetchedData()]);
    if (report) {
      setState({ stage: "done", report, markdown: toMarkdown(report), posts: posts ?? [] });
    } else if (posts) {
      setState({ stage: "fetched", posts });
    }
  }, []);

  /** 步骤1 内部：抓取帖子 + 评论，整段完成后原子落盘 */
  const fetchData = useCallback(async (task: TaskConfig): Promise<void> => {
    setState({ stage: "fetching", progress: "正在抓取帖子列表…" });
    try {
      await rotateUa(); // 抓取期间启用 UA 轮换规则
      const posts = await fetchPostsWithComments(
        { subreddit: task.subreddit, mode: task.mode, keyword: task.keyword },
        task.limit,
        task.maxComments,
        (message) => setState({ stage: "fetching", progress: message })
      );
      await clearUaRule();

      if (posts.length === 0) {
        setState({
          stage: "error",
          message: "未抓到任何数据，请检查子版名/关键词是否正确",
          from: "fetch",
        });
        return;
      }

      await saveFetchedData(posts);
      setState({ stage: "fetched", posts });
    } catch (err) {
      await clearUaRule();
      setState({ stage: "error", message: `抓取出错：${(err as Error).message}`, from: "fetch" });
    }
  }, []);

  /** 步骤1 → 步骤2：AI 两阶段分析（需要用户手动触发） */
  const startAnalysis = useCallback(async (api: ApiSettings, task: TaskConfig): Promise<void> => {
    const posts = await getFetchedData();
    if (!posts) {
      setState({ stage: "error", message: "没有可分析的数据，请先抓取", from: "analyze" });
      return;
    }

    setState({
      stage: "analyzing",
      progress: "正在准备分析…",
      phase: "extract",
      batch: 0,
      batches: 0,
      posts,
    });
    try {
      const report = await runAnalysis(
        posts,
        api,
        { subreddit: task.subreddit, keyword: task.keyword },
        (p) =>
          setState({
            stage: "analyzing",
            progress: p.detail,
            phase: p.phase,
            batch: p.batch,
            batches: p.batches,
            posts,
          })
      );
      await saveReport(report);
      setState({ stage: "done", report, markdown: toMarkdown(report), posts });
    } catch (err) {
      setState({ stage: "error", message: `分析出错：${(err as Error).message}`, from: "analyze" });
    }
  }, []);

  /** 重新开始：清空落盘数据回到步骤1 */
  const reset = useCallback(async (): Promise<void> => {
    await Promise.all([clearFetchedData(), clearReport()]);
    setState({ stage: "config" });
  }, []);

  /** 回到步骤1：有数据则恢复「数据预览」，否则回到「配置」 */
  const gotoStep = useCallback(async (step: 1 | 2): Promise<void> => {
    if (step === 1) {
      const posts = await getFetchedData();
      setState(posts ? { stage: "fetched", posts } : { stage: "config" });
    }
    // 步骤2 只能通过「开始 AI 分析」到达，不提供跳转
  }, []);

  return { state, restore, fetchData, startAnalysis, reset, gotoStep };
}
