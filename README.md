# Echo-String: Genesis Prototype

《语弦生态：创世纪》的可玩网页原型。1.0.0 版本聚焦“断句庭院”垂直切片：玩家通过扫描对象、剥离词缀、注入语义槽位和触发组合反应，验证这套语义改写玩法是否足够清楚、可玩、可继续扩展。

[在线试玩](https://wangjiehu.github.io/echo-string-genesis-prototype/)
[GitHub 仓库](https://github.com/Lunora-Gather/echo-string-genesis-prototype)

## 1.0.0 状态

- Z1 到 Z7 已完整串联，可在浏览器内直接通关。
- 支持引导、低引导、调试三种测试模式。
- 已接入真实浏览器 DOM 点击回归、玩家可见路径审计、失败上下文审计和桌面/手机视觉 Smoke。
- UI 已统一为更圆润的 Morandi 低饱和配色，并使用 Noto Sans SC 字体。
- 当前仓库以 1.0.0 作为公开发布基线，不再把旧迭代流水账作为首页入口。

## 玩法概览

核心循环很短，但必须被玩家真实理解：

1. 扫描场景对象，读出可交互语义。
2. 从对象上剥离合适词缀，放入临时词库。
3. 将词缀注入开放槽位，改变机关、敌人或环境状态。
4. 组合温度、介质、力场等词缀，触发蒸汽爆发、破裂窗口、力场震荡等反应。
5. 进入 Boss 残章守卫阶段，用前面学到的语义反制完成闭环。

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `prototype/` | 无构建静态网页原型，GitHub Pages 直接发布这个目录 |
| `data/` | MVP 词缀、对象和组合反应数据 |
| `design/` | 断句庭院灰盒、战斗切片和谜题路线文档 |
| `scripts/` | 校验、回归、报告、视觉 Smoke 脚本 |
| `production/` | 1.0.0 验证报告和试玩记录模板 |
| `Echo-String_Genesis_可执行设计规格.md` | 可执行设计规格 |

## 本地运行

```powershell
cd "D:\Wonderful\Others\echo string-genesis prototype"
powershell -ExecutionPolicy Bypass -File .\prototype\start.ps1 -Port 4174
```

打开脚本输出的地址，例如：

```text
http://127.0.0.1:4174/index.html
```

## 验证

完整验证会刷新 1.0.0 报告、真实点击记录、视觉截图和摘要：

```powershell
cd "D:\Wonderful\Others\echo string-genesis prototype"
powershell -ExecutionPolicy Bypass -File .\scripts\validate_project.ps1 -Port 4174
```

也可以分项运行：

```powershell
node .\scripts\run_app_regression.mjs
node .\scripts\run_failure_audit.mjs
node .\scripts\run_player_path_audit.mjs
node .\scripts\run_dom_click_regression.mjs http://127.0.0.1:4174/index.html
node .\scripts\run_visual_smoke.mjs http://127.0.0.1:4174/index.html
```

## 关键产物

| 文件 | 说明 |
| --- | --- |
| `production/latest_1_0_0_report.json` | 1.0.0 主回归与审计报告 |
| `production/latest_1_0_0_summary.md` | 1.0.0 可读摘要 |
| `production/latest_1_0_0_dom_click_report.json` | 真实浏览器 DOM 点击回归 |
| `production/latest_1_0_0_visual_smoke_report.json` | 桌面/手机视觉 Smoke |
| `prototype/prototype_1_0_0_full.png` | 桌面首屏截图 |
| `prototype/prototype_1_0_0_mobile.png` | 手机低引导首屏截图 |

## 当前不做

这些方向保留，但不进入 1.0.0 基线：自由文本输入、开放世界、大规模文明语系切换、复杂因果闭环、真实流体模拟、大量装备等级成长。当前最重要的是证明“扫描、取词、改写、反应”这一小闭环能被新玩家理解并产生乐趣。

## 下一步

最值得继续投入的是低引导真人试玩。建议记录每区耗时、误操作、玩家复述、卡点原因和首次理解语义改写的时刻，再决定是否调整教学节奏、低引导信息密度和 Boss 前置训练。
