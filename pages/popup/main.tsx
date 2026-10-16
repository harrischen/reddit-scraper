/**
 * 页面入口：React 挂载点
 *
 * 不包 StrictMode——本应用是长任务副作用型（抓取+AI 分析耗时数分钟），
 * 开发模式的双调用会触发重复执行，无益处。
 */

import { createRoot } from "react-dom/client";
import App from "./App";
import "./popup.css";
import "./report.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing #root");

createRoot(rootEl).render(<App />);
