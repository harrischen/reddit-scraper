/**
 * VOC 分析编排层：两阶段 AI 分析，产出「需求信号」选品决策看板（VocReport v3）
 *
 * 为什么两阶段：
 * 1. 控 token：帖子+评论总量可能几十万 token，必须分批
 * 2. 防幻觉：AI 只负责分类、聚类、打分、verbatim 摘录和翻译；
 *    链接、频次、机会分、指标由前端从原始数据生成，摘录做子串校验
 *
 * 阶段一（抽取）：分批抽取两类原子条目——need（需求/痛点/场景，含情绪）、
 *   workaround（现有解决办法 + 缺陷）
 * 阶段二（聚合 + 打分）：聚类 need → 需求信号，匹配 workaround → 信号，
 *   并给每条信号打 importance/satisfaction/willingness/competition 等分
 * 最后：resolveReport 做证据回链 + 子串校验 + 频次/机会分/指标计算
 */

import { chatCompletionValidated } from "@/src/utils/ai";
import {
  AGGREGATE_JSON_SCHEMA,
  EXTRACTION_JSON_SCHEMA,
  aggregateZod,
  extractionZod,
  type AggregateResponse,
  type ExtractionResponse,
} from "@/src/schema/reportSchema";
import type {
  ApiSettings,
  RedditPostRow,
  Signal,
  SignalQuote,
  VocMetrics,
  VocReport,
} from "@/src/types";

const SELF_TEXT_LIMIT = 800; // 正文截断长度
const COMMENT_BODY_LIMIT = 300; // 单条评论截断长度
const EVIDENCE_QUOTE_LIMIT = 300; // 证据原话展示截断长度
// 每批 token 上限。主流模型普遍支持 ≥1M 上下文，取 10 万可明显减少批次数；
// 仍分批是为了控制单次「抽取输出」的规模（输出 JSON 过长易截断、召回下降）。
const MAX_BATCH_TOKENS = 100000;
const OPPORTUNITY_THRESHOLD = 12; // 高机会需求阈值

/** 分析进度（结构化，供 UI 展示阶段与批次进度条） */
export interface AnalysisProgress {
  phase: "extract" | "aggregate";
  /** 当前批（1 起），aggregate 阶段为 0 */
  batch: number;
  /** 总批数，aggregate 阶段为 0 */
  batches: number;
  /** 当前步骤内的短说明，如「本批 7 篇」「共 23 条原子条目」 */
  detail: string;
}

type ProgressFn = (p: AnalysisProgress) => void;

/** 阶段一抽取的原子条目（need / workaround 两种） */
type ExtractionItem = ExtractionResponse["items"][number];

function truncate(text: string, limit: number): string {
  if (!text) return "";
  const t = text.trim();
  return t.length > limit ? t.slice(0, limit) + "…" : t;
}

/** 把一篇帖子（含评论）拼成给 AI 看的文本块，评论带 id 标记供引用 */
function buildPostText(post: RedditPostRow): string {
  const parts: string[] = [`[帖子 ${post.id}] 标题: ${post.title}`];
  const body = truncate(post.selftext, SELF_TEXT_LIMIT);
  if (body) parts.push(`正文: ${body}`);
  if (post.comments.length > 0) {
    const commentLines = post.comments.map(
      (c) => `  - [评论 ${c.id}] (${c.score}赞): ${truncate(c.body, COMMENT_BODY_LIMIT)}`
    );
    parts.push(`评论(${post.comments.length}条):\n${commentLines.join("\n")}`);
  }
  return parts.join("\n");
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** 按 token 动态分批，避免单批超出 LLM 上下文 */
function chunkByTokens(posts: RedditPostRow[], maxTokens: number): RedditPostRow[][] {
  const batches: RedditPostRow[][] = [];
  let current: RedditPostRow[] = [];
  let currentTokens = 0;
  for (const post of posts) {
    const t = estimateTokens(buildPostText(post));
    if (current.length > 0 && currentTokens + t > maxTokens) {
      batches.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(post);
    currentTokens += t;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/** 阶段一抽取 prompt：抽 need / workaround 两类原子条目（含 verbatim 摘录） */
const EXTRACT_SYSTEM_PROMPT = `你是市场研究助手。下面是一些 Reddit 帖子（含标题、正文、评论，每条评论带 [评论 id] 标记）。

请从中抽取两类原子条目（忽略跑题、纯推广、广告、无实质信息的内容）：

1. need 需求/痛点/场景：用户在什么情境下需要什么、抱怨什么、想达到什么效果。例如 "小公寓没地方收纳" "开放式厨房有味道散不掉" "想要能坐又能展开当床的沙发"
2. workaround 现有解决办法：用户现在怎么凑合解决，以及这个办法的缺陷。例如 "一直堆宜家格子柜，但快散架了"

need 条目字段：
- type: "need"
- text: 内容概括（简短中文，保留英文关键词）
- emotion: 情绪 "negative" | "mixed" | "positive"
- post_id: 所属帖子 id
- comment_id: 若证据来自某条评论则填评论 id，来自帖子则填 null
- quote_en: 支撑该条目的英文原话，必须是对原文的逐字摘录（可截取句子片段，禁止改写、翻译、拼接多个句子），不超过 40 词

workaround 条目字段：
- type: "workaround"
- text: 内容概括（简短中文）
- solution: 用户用的现有办法（简短，如 "宜家格子柜"）
- drawback: 这个办法的缺陷/不满（如 "易散架"）
- post_id / comment_id / quote_en: 同上

只返回 JSON，不要其他文字。格式：
{"items":[{"type":"need","text":"小公寓收纳不足","emotion":"negative","post_id":"帖子id","comment_id":null,"quote_en":"Our tiny apartment has zero storage..."},{"type":"workaround","text":"用宜家格子柜凑合","solution":"宜家格子柜","drawback":"易散架","post_id":"帖子id","comment_id":null,"quote_en":"I've been stacking IKEA cubes, but they're falling apart."}]}`;

/** 阶段二聚合 prompt：聚类 need → 信号，匹配 workaround，并打分 */
const AGGREGATE_SYSTEM_PROMPT = `你是市场研究分析师。下面是第一阶段从 Reddit 讨论中抽取的原子条目（need 和 workaround 两类，含 post_id/comment_id/quote_en）。

请把它们聚合成一组「需求信号」，每条信号是一个独立的、可指导选品的用户需求。要求 4-10 条信号。

每条信号字段：
- name: 需求名称（简短中文，例如 "小空间垂直收纳不足"）
- importance: 重要性 0-10 整数。评分标准：用户多在意这个问题（提及频次、情绪强度、是否反复抱怨、是否影响核心体验）
- satisfaction: 现有方案满意度 0-10 整数。评分标准：用户对现有解决办法的满意程度，越低表示现有方案越"凑合"、切入机会越大
- willingness: 付费意愿，"高" | "中高" | "中" | "低"
- current: 现有解决办法（用户现在怎么凑合，简短概括，没有则空字符串）
- flaw: 现有方案的缺陷/不满点（简短概括，没有则空字符串）
- competition: 竞争度，"低" | "中" | "高"（判断：现有市场是否已有成熟方案、用户是否还在用 DIY 凑合）
- angle: 切入角度（一句产品机会建议，如 "免打孔模块化墙面收纳"）
- emotion: "negative" | "mixed" | "positive"（该需求主导情绪）
- post_ids: 该信号涉及的所有帖子 id（从输入条目里选取，去重）
- quotes: 2-4 条支撑该需求的证据（从 need 条目里选）
- cur_quotes: 1-2 条对现有方案不满的原话（从 workaround 条目里选）

硬性规则：
- quotes/cur_quotes 元素形如 {"post_id":"...","comment_id":null 或 "评论id","quote_en":"...","quote_zh":"..."}，post_id/comment_id 必须与输入条目一致，quote_en 必须原样复制输入条目的 quote_en（禁止改写），quote_zh 是它的中文翻译
- post_ids 必须从输入条目里选取
- 不输出任何链接、不输出频次数字（频次由前端统计）
- 没有信号的极端情况用空数组 []

只返回 JSON，不要其他文字。`;

/** 从阶段一返回里取出条目数组 */
function extractBatch(
  settings: ApiSettings,
  posts: RedditPostRow[]
): Promise<ExtractionItem[]> {
  const userContent = posts.map(buildPostText).join("\n\n---\n\n");
  return chatCompletionValidated<ExtractionResponse>(
    settings,
    [
      { role: "system", content: EXTRACT_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    extractionZod,
    { type: "json_schema", json_schema: EXTRACTION_JSON_SCHEMA }
  ).then((r) => r.items);
}

function aggregate(
  settings: ApiSettings,
  items: ExtractionItem[]
): Promise<AggregateResponse> {
  const userContent = JSON.stringify(items);
  return chatCompletionValidated<AggregateResponse>(
    settings,
    [
      { role: "system", content: AGGREGATE_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    aggregateZod,
    { type: "json_schema", json_schema: AGGREGATE_JSON_SCHEMA }
  );
}

// ===== 证据回链与校验 =====

/** 归一化文本用于子串比对：小写 + 折叠空白 + 剥除常见 markdown 记号 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[*_`>~[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 原始数据索引：帖子/评论的原文与链接 */
interface SourceIndex {
  postById: Map<string, RedditPostRow>;
  commentById: Map<string, { body: string; permalink: string; score: number }>;
}

function buildSourceIndex(posts: RedditPostRow[]): SourceIndex {
  const postById = new Map(posts.map((p) => [p.id, p]));
  const commentById = new Map<
    string,
    { body: string; permalink: string; score: number }
  >();
  for (const p of posts) {
    for (const c of p.comments) {
      commentById.set(c.id, { body: c.body, permalink: c.permalink, score: c.score });
    }
  }
  return { postById, commentById };
}

/** 原始证据 → SignalQuote；校验失败（id 不存在 / 摘录非原文子串）返回 null */
function resolveQuote(
  raw: { post_id: string; comment_id: string | null; quote_en: string; quote_zh: string },
  index: SourceIndex
): SignalQuote | null {
  const quote = normalize(raw.quote_en);
  if (!quote) return null;

  if (raw.comment_id) {
    const c = index.commentById.get(raw.comment_id);
    if (!c || !index.postById.has(raw.post_id)) return null;
    if (!normalize(c.body).includes(quote)) return null;
    return {
      quote_en: truncate(raw.quote_en, EVIDENCE_QUOTE_LIMIT),
      quote_zh: raw.quote_zh,
      permalink: c.permalink,
      source_type: "comment",
      score: c.score,
    };
  }

  const p = index.postById.get(raw.post_id);
  if (!p) return null;
  const source = normalize(`${p.title} ${p.selftext}`);
  if (!source.includes(quote)) return null;
  return {
    quote_en: truncate(raw.quote_en, EVIDENCE_QUOTE_LIMIT),
    quote_zh: raw.quote_zh,
    permalink: p.permalink,
    source_type: "post",
    score: p.score,
  };
}

/** 从 permalink 提取 post_id（/comments/{id}/） */
function postIdFromPermalink(permalink: string): string | null {
  const m = permalink.match(/\/comments\/([a-z0-9]+)/i);
  return m ? m[1] : null;
}

/** 机会分公式：importance + max(importance − satisfaction, 0)，区间 0-20 */
function opportunityScore(importance: number, satisfaction: number): number {
  return importance + Math.max(importance - satisfaction, 0);
}

/**
 * 把聚合结果 resolve 成最终报告：
 * - 证据回链（permalink 来自原始数据）+ 子串校验防编造
 * - freq / opportunity / id / metrics 前端重算
 */
function resolveReport(
  agg: AggregateResponse,
  posts: RedditPostRow[],
  reportMeta: { category: string }
): VocReport {
  const index = buildSourceIndex(posts);
  const citedPosts = new Set<string>();

  const rawSignals = agg.signals ?? [];

  const signals: Signal[] = rawSignals.map((s) => {
    const quotes = (s.quotes ?? [])
      .map((q) => resolveQuote(q, index))
      .filter((q): q is SignalQuote => q !== null);
    const cur_quotes = (s.cur_quotes ?? [])
      .map((q) => resolveQuote(q, index))
      .filter((q): q is SignalQuote => q !== null);

    // 频次 = 有效 post_ids 去重；全失效时用证据链接里的 post_id 兜底
    const validPostIds = new Set((s.post_ids ?? []).filter((id) => index.postById.has(id)));
    for (const q of [...quotes, ...cur_quotes]) {
      const id = postIdFromPermalink(q.permalink);
      if (id) {
        citedPosts.add(id);
        if (validPostIds.size === 0) validPostIds.add(id);
      }
    }

    return {
      id: "", // 排序后统一生成 S1/S2…
      name: s.name,
      freq: validPostIds.size,
      importance: s.importance,
      satisfaction: s.satisfaction,
      willingness: s.willingness,
      current: s.current ?? "",
      flaw: s.flaw ?? "",
      competition: s.competition,
      angle: s.angle ?? "",
      emotion: s.emotion,
      opportunity: opportunityScore(s.importance, s.satisfaction),
      quotes,
      cur_quotes,
    };
  });

  // 按机会分降序，生成 S1/S2… id
  signals.sort((a, b) => b.opportunity - a.opportunity);
  signals.forEach((s, i) => {
    s.id = `S${i + 1}`;
  });

  const totalComments = posts.reduce((sum, p) => sum + p.comments.length, 0);
  const metrics: VocMetrics = {
    scraped: posts.length + totalComments,
    valid: citedPosts.size,
    signals: signals.length,
    top_opportunities: signals.filter((s) => s.opportunity >= OPPORTUNITY_THRESHOLD).length,
  };

  return {
    version: 3,
    category: reportMeta.category,
    market: "美区",
    platform: "Reddit",
    generated_at: new Date().toISOString(),
    metrics,
    signals,
  };
}

/**
 * 完整分析流程入口：两阶段分析 + 证据回链校验 + 机会分/指标计算。
 */
export async function runAnalysis(
  posts: RedditPostRow[],
  settings: ApiSettings,
  reportMeta: { subreddit: string; keyword: string },
  onProgress: ProgressFn
): Promise<VocReport> {
  // 阶段一：分批抽取
  const batches = chunkByTokens(posts, MAX_BATCH_TOKENS);
  const allItems: ExtractionItem[] = [];
  for (let i = 0; i < batches.length; i++) {
    onProgress({
      phase: "extract",
      batch: i + 1,
      batches: batches.length,
      detail: `本批 ${batches[i].length} 篇`,
    });
    const items = await extractBatch(settings, batches[i]);
    allItems.push(...items);
  }

  if (allItems.length === 0) {
    throw new Error("第一阶段没有抽取到任何条目，请检查数据或更换模型");
  }

  // 阶段二：聚类 + 打分（跨批次聚合，这一步才形成「全面」的需求信号）
  onProgress({
    phase: "aggregate",
    batch: 0,
    batches: 0,
    detail: `共 ${allItems.length} 条原子条目`,
  });
  const agg = await aggregate(settings, allItems);

  const category = reportMeta.subreddit || reportMeta.keyword || "未指定";
  return resolveReport(agg, posts, { category });
}
