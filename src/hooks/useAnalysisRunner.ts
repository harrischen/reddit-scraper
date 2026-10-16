/**
 * 分析流程 hook：抓数据（帖子+评论）→ AI 分析 → Markdown
 *
 * 状态机：idle → running（带进度消息）→ done（报告+原始数据+md）| error
 * 由 App 在「开始分析」点击和「pending 自动执行」时调用 run()。
 */

import { useCallback, useState } from "react";
import { fetchPostsWithComments } from "@/src/utils/reddit";
import { runAnalysis } from "@/src/utils/analyze";
import { toMarkdown } from "@/src/utils/report";
import type { ApiSettings, RedditPostRow, TaskConfig, VocReport } from "@/src/types";

export type AnalysisState =
  | { phase: "idle" }
  | { phase: "running"; progress: string }
  | { phase: "done"; report: VocReport; posts: RedditPostRow[]; markdown: string }
  | { phase: "error"; message: string };

export function useAnalysisRunner() {
  const [state, setState] = useState<AnalysisState>({ phase: "idle" });

  const run = useCallback(async (api: ApiSettings, task: TaskConfig): Promise<void> => {
    setState({ phase: "running", progress: "正在抓取帖子列表…" });
    try {
      const posts = await fetchPostsWithComments(
        { subreddit: task.subreddit, mode: task.mode, keyword: task.keyword },
        task.limit,
        task.maxComments,
        (message) => setState({ phase: "running", progress: message })
      );

      if (posts.length === 0) {
        setState({ phase: "error", message: "未抓到任何数据，请检查子版名/关键词是否正确" });
        return;
      }

      const report = await runAnalysis(
        posts,
        api,
        { subreddit: task.subreddit, keyword: task.keyword },
        (message) => setState({ phase: "running", progress: message })
      );

      setState({ phase: "done", report, posts, markdown: toMarkdown(report) });
    } catch (err) {
      setState({ phase: "error", message: `出错：${(err as Error).message}` });
    }
  }, []);

  return { state, run };
}
