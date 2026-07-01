# 1.0.0 交付清单

日期：2026-06-10
项目：Echo-String: Genesis Prototype
仓库：`wangjiehu/echo-string-genesis-prototype`
网页试玩：<https://wangjiehu.github.io/echo-string-genesis-prototype/>

## 交付范围

| 类型 | 文件 |
| --- | --- |
| 网页入口 | [prototype/index.html](../prototype/index.html) |
| 玩法逻辑 | [prototype/app.js](../prototype/app.js) |
| 回归审计 | [prototype/regression.js](../prototype/regression.js) |
| 视觉样式 | [prototype/styles.css](../prototype/styles.css) |
| 本地启动 | [prototype/start.ps1](../prototype/start.ps1) |
| 总校验 | [scripts/validate_project.ps1](../scripts/validate_project.ps1) |
| 真实点击回归 | [scripts/run_dom_click_regression.mjs](../scripts/run_dom_click_regression.mjs) |
| 视觉 Smoke | [scripts/run_visual_smoke.mjs](../scripts/run_visual_smoke.mjs) |
| GitHub Pages | [.github/workflows/deploy-pages.yml](../.github/workflows/deploy-pages.yml) |
| 设计规格 | [Echo-String_Genesis_可执行设计规格.md](../Echo-String_Genesis_可执行设计规格.md) |

## 最新验证产物

| 类型 | 文件 |
| --- | --- |
| 主报告 | [production/latest_1_0_0_report.json](./latest_1_0_0_report.json) |
| 摘要 | [production/latest_1_0_0_summary.md](./latest_1_0_0_summary.md) |
| 显隐记录 | [production/latest_1_0_0_visibility_report.json](./latest_1_0_0_visibility_report.json) |
| DOM 点击 | [production/latest_1_0_0_dom_click_report.json](./latest_1_0_0_dom_click_report.json) |
| 视觉 Smoke | [production/latest_1_0_0_visual_smoke_report.json](./latest_1_0_0_visual_smoke_report.json) |
| 桌面截图 | [prototype/prototype_1_0_0_full.png](../prototype/prototype_1_0_0_full.png) |
| 手机截图 | [prototype/prototype_1_0_0_mobile.png](../prototype/prototype_1_0_0_mobile.png) |

## 当前体验状态

- Z1 到 Z7 完整可通关。
- 引导、低引导、调试三模式可切换。
- 低引导隐藏答案泄漏，未扫描对象不会暴露关键词名、槽位和成本。
- Boss 末尾路径已纳入玩家可见路径审计，避免脚本可过但真实点击不可达。
- 视觉系统已切换为圆润 Morandi 配色和 Noto Sans SC 字体。
- 真实浏览器 DOM 点击、桌面首屏、手机低引导首屏都纳入总验证链路。
- 报告导出已包含 `playtest` 观察包：匿名试玩规则、理解追问、Z5/Boss风险信号和观察者 Markdown。

## 1.0.0 验收项

| 验证项 | 结果 |
| --- | --- |
| JSON 解析与词缀引用 | 通过 |
| JS 语法检查 | 通过 |
| 数据与运行时一致性 | 通过 |
| UI 合约检查 | 通过 |
| 引导/低引导应用回归 | 通过 |
| 失败上下文审计 | 通过 |
| 玩家可见路径审计 | 通过 |
| 真实 DOM 点击双模式回归 | 通过 |
| 桌面/手机视觉 Smoke | 通过 |
| 低引导真人试玩观察包 | 通过 |
| GitHub Pages 发布 | 通过 |

## 后续建议

不要急着扩世界或追加复杂系统。下一阶段应优先进行 3 到 5 名低引导真人试玩，使用报告 JSON 中的 `playtest.observerMarkdown` 和记录模板同步记录每区耗时、误操作、复述质量和卡点原因，再决定是否调整教学节奏、低引导信息密度和 Boss 前置训练。
