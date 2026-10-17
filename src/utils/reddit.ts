/**
 * Reddit 数据抓取层
 *
 * 全部走 Reddit 公开的 .json 端点，不依赖官方 API、无需 OAuth。
 * 请求都在用户浏览器本地发出（天然落在用户自己的住宅 IP），
 * 配合节流控制，避免集中式爬虫被识别/封锁。
 *
 * 限流背景：未登录的公开 .json 端点限流约 10 次/分钟/IP。
 * - 列表抓取：每页请求间隔 1.5-2.5s（分页最多 5 页，远低于门槛）
 * - 评论抓取：每帖请求间隔约 7s（50 帖 ≈ 6 分钟，严格低于门槛）
 * - 遇 429：读 Retry-After 等待后重试（最多 2 次），并整体抬高后续请求间隔
 */

import type { FetchParams, RedditComment, RedditPostRow } from "@/src/types";
import { rotateUa } from "@/src/utils/requestGuard";

export const PAGE_SIZE = 100; // Reddit 列表接口单页上限（平台硬限制，最多一次返回 100 条）
export const MAX_PAGES = 5; // 分页上限，与 10 次/分钟的限速对齐留余量

/** 列表分页之间的节流间隔 */
const MIN_DELAY_MS = 1500;
const MAX_EXTRA_DELAY_MS = 1000;

/** 评论请求间隔约 7 秒，确保低于 10 次/分钟的未登录限流 */
const COMMENT_MIN_DELAY_MS = 6500;
const COMMENT_MAX_EXTRA_DELAY_MS = 1000;

/**
 * 全局节流系数：每触发一次 429 乘 1.5（封顶 4），本次页面生命周期内不回落。
 * 乘到列表/评论的基础间隔上，实现「被限流后整体放慢」的自适应。
 */
let rateMultiplier = 1;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带 429 退避的 fetch：触发限流时读 Retry-After（缺省 60s）等待后重试，
 * 最多 maxRetries 次；每次重试同时轮换 UA 并抬高全局节流系数。
 * 重试耗尽后抛出带等待时长的错误。
 */
async function fetchWithBackoff(
  url: string,
  init: RequestInit,
  maxRetries = 2
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 429) return res;

    if (attempt >= maxRetries) {
      throw new Error(
        `触发 Reddit 限流（429），已自动等待重试 ${maxRetries} 次仍失败。请等待几分钟后再试，或减少抓取数量`
      );
    }

    rateMultiplier = Math.min(rateMultiplier * 1.5, 4);
    void rotateUa(); // 换一个指纹再试
    const retryAfterSec = parseInt(res.headers.get("Retry-After") ?? "", 10);
    const waitMs = (Number.isFinite(retryAfterSec) && retryAfterSec > 0
      ? retryAfterSec
      : 60) * 1000;
    await sleep(waitMs);
  }
}

/**
 * 构造列表请求 URL。
 * 普通排序走 /r/{sub}/{mode}.json，搜索走 /search.json（可选 restrict_sr 限定子版）。
 * after 是分页游标，来自上一页响应的 data.after。
 * pageLimit 是「本页」请求的条数（受 Reddit 单页上限 100 约束），
 * 与用户填的「总数量」不同——总数量由 fetchAll 翻页凑齐。
 */
export function buildUrl(
  params: FetchParams & { after: string | null; pageLimit?: number }
): string {
  const { subreddit, mode, keyword, after, pageLimit } = params;
  const query = new URLSearchParams({
    limit: String(pageLimit ?? PAGE_SIZE),
    raw_json: "1",
  });
  if (after) query.set("after", after);

  if (mode === "search") {
    query.set("q", keyword);
    query.set("sort", "relevance");
    if (subreddit) {
      query.set("restrict_sr", "1");
      return `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/search.json?${query.toString()}`;
    }
    return `https://www.reddit.com/search.json?${query.toString()}`;
  }

  if (!subreddit) {
    throw new Error("非关键词搜索模式必须填写子版名");
  }
  return `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/${mode}.json?${query.toString()}`;
}

/**
 * 把列表接口返回的单个 t3 子节点映射成 RedditPostRow。
 * child 是 Reddit 原始 JSON 节点，结构复杂，这里只取需要的字段（用 any 简化）。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPost(child: any): RedditPostRow {
  const d = child.data;
  return {
    id: d.id,
    title: d.title,
    author: d.author,
    subreddit: d.subreddit,
    score: d.score,
    upvote_ratio: d.upvote_ratio,
    num_comments: d.num_comments,
    created_utc: new Date(d.created_utc * 1000).toISOString(), // unix 秒 → ISO 字符串
    permalink: `https://www.reddit.com${d.permalink}`, // 补全域名，便于报告回链
    url: d.url,
    selftext: d.selftext || "",
    link_flair_text: d.link_flair_text || "",
    is_self: d.is_self,
    over_18: d.over_18,
    comments: [], // 评论由 fetchComments 后续填充
  };
}

/**
 * 抓取帖子列表（不含评论）。
 * 按 after 游标分页，直到拿够 totalWanted 条或没有更多数据。
 */
export async function fetchAll(
  params: FetchParams,
  totalWanted: number,
  onProgress?: (page: number, fetched: number) => void
): Promise<RedditPostRow[]> {
  const results: RedditPostRow[] = [];
  let after: string | null = null;
  let page = 0;

  while (results.length < totalWanted && page < MAX_PAGES) {
    page += 1;
    onProgress?.(page, results.length);

    // 每页请求「剩余还需要多少」和「单页上限 100」的较小值，避免多抓再截断
    const pageLimit = Math.min(totalWanted - results.length, PAGE_SIZE);
    const url = buildUrl({ ...params, after, pageLimit });
    const res = await fetchWithBackoff(url, {
      headers: { Accept: "application/json" },
    });

    if (res.status === 403 || res.status === 404) {
      throw new Error("子版不存在、已被封禁或为私密版块，请检查子版名是否正确");
    }
    if (!res.ok) {
      throw new Error(`请求失败，状态码 ${res.status}`);
    }

    const json = await res.json();
    const children = json?.data?.children ?? [];
    for (const child of children) {
      if (child.kind === "t3") {
        results.push(mapPost(child)); // 只取帖子节点，忽略其他类型
      }
    }

    after = json?.data?.after ?? null;
    if (!after || children.length === 0) break; // 没有下一页则结束

    // 分页之间节流，避免触发限流（429 后自动放慢）
    if (results.length < totalWanted && page < MAX_PAGES) {
      await sleep((MIN_DELAY_MS + Math.random() * MAX_EXTRA_DELAY_MS) * rateMultiplier);
    }
  }

  return results.slice(0, totalWanted);
}

/** 评论树 JSON 节点的最小结构（只取用到的字段） */
interface RedditJsonNode {
  kind?: string;
  data?: {
    children?: RedditJsonNode[];
    id?: string;
    author?: string;
    score?: number;
    body?: string;
    permalink?: string;
    // replies 为 "" 表示无回复；为对象时是嵌套的 Listing；还有一种是 "more" 占位节点
    replies?: "" | { kind: string; data: { children?: RedditJsonNode[] } };
  };
}

/**
 * 递归展开评论树，扁平化收集评论。
 * - t1 节点是评论，收集后继续递归其 replies
 * - "more" 占位节点忽略（超长线程不展开，接受单次请求的 limit 作为安全阀）
 */
function walkComments(
  node: RedditJsonNode,
  out: RedditComment[],
  max: number,
  depth: number
): void {
  if (out.length >= max) return;
  const children = node?.data?.children ?? [];
  for (const child of children) {
    if (out.length >= max) break;
    if (child?.kind === "t1") {
      const d = child.data ?? {};
      out.push({
        id: d.id ?? "",
        author: d.author ?? "",
        score: d.score ?? 0,
        body: d.body ?? "",
        depth,
        permalink: `https://www.reddit.com${d.permalink ?? ""}`, // 补全域名，便于证据溯源
      });
      if (d.replies && typeof d.replies === "object" && d.replies.data) {
        walkComments(d.replies, out, max, depth + 1);
      }
    }
    // kind === "more" 忽略
  }
}

/**
 * 抓取单篇帖子的评论。
 * 评论接口返回 [帖子, 评论树] 两段，评论树是 json[1]。
 * 单次请求的 limit 上限 500 条，超长线程靠 more 节点展开（这里不展开）。
 */
export async function fetchComments(
  subreddit: string,
  postId: string,
  maxComments: number
): Promise<RedditComment[]> {
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/comments/${postId}.json?limit=${maxComments}&raw_json=1`;
  const res = await fetchWithBackoff(url, { headers: { Accept: "application/json" } });

  if (!res.ok) {
    // 帖子被删/私密等，评论抓取失败不致命，返回空数组继续后续帖子
    return [];
  }

  const json = await res.json();
  const commentTree = json?.[1];
  const out: RedditComment[] = [];
  walkComments(commentTree, out, maxComments, 0);
  return out;
}

/**
 * 抓取帖子列表 + 逐帖评论，是分析前的完整数据采集入口。
 * - 先 fetchAll 抓列表
 * - 再对每篇帖子调 fetchComments 抓评论，逐帖节流（约 7s/帖）
 * onProgress 用字符串消息，直接透传给 UI 展示。
 */
export async function fetchPostsWithComments(
  params: FetchParams,
  totalWanted: number,
  maxComments: number,
  onProgress?: (message: string) => void
): Promise<RedditPostRow[]> {
  const posts = await fetchAll(params, totalWanted, (page, fetched) => {
    onProgress?.(`正在抓取帖子列表第 ${page} 页…（已获取 ${fetched} 条）`);
  });

  let totalComments = 0;
  for (let i = 0; i < posts.length; i++) {
    onProgress?.(`正在抓取评论 ${i + 1}/${posts.length}…（已累计 ${totalComments} 条评论）`);
    const comments = await fetchComments(posts[i].subreddit, posts[i].id, maxComments);
    posts[i].comments = comments;
    totalComments += comments.length;
    await sleep((COMMENT_MIN_DELAY_MS + Math.random() * COMMENT_MAX_EXTRA_DELAY_MS) * rateMultiplier);
  }

  onProgress?.(`数据抓取完成：${posts.length} 篇帖子，共 ${totalComments} 条评论`);
  return posts;
}
