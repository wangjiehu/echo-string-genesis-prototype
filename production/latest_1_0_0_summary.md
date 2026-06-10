# 回归套件报告摘要

生成时间：2026-06-10 21:56:25
报告来源：`production\latest_1_0_0_report.json`

## 1. 总览

| 项目 | 数值 |
| --- | --- |
| 构建 | 1.0.0 |
| 套件通过 | True |
| 引导质量 | S / 100 |
| 低引导质量 | S / 100 |
| 引导误操作 | 0 |
| 低引导误操作 | 0 |

## 2. 双模式指标

| 模式 | 完成 | 扫描 | 剥离 | 注入 | 断言 | Boss反制 | 组合反应 | 反馈事件 | 失败事件 | 体验状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 引导 | True | 19 | 12 | 12 | 6 | 3 | 4 | 40 | 0 | clear |
| 低引导 | True | 19 | 12 | 12 | 6 | 3 | 4 | 40 | 0 | clear |

## 3. 推进账本

| 版本 | 重点 |
| --- | --- |
| UX11 | 低引导自动回归 |
| UX12 | 卡点与软锁审计 |
| UX13 | 通关质量评分 |
| UX14 | Boss反制路线账本 |
| UX15 | 检查点恢复 |
| UX16 | 回归套件入口 |
| UX17 | 报告结构增强 |
| UX18 | 完成面板复盘增强 |
| UX19 | 验证脚本加严 |
| UX20 | 生产文档收口 |
| UX21 | 真人试玩反馈硬化 |
| 1.0.0 | 公开发布与圆润视觉系统 |

## 4. 失败审计

| 分类 | 场景 |
| --- | --- |
| tag-unavailable | 剥离目标不提供的词 |
| inventory-full | 词库满时继续剥离 |
| slot-missing | 向无槽机关写入结构词 |
| slot-locked | 向锁定火盆写入温度词 |
| ink-low | 原墨不足时剥离 |

失败上下文事件：5

## 5. 真实可见路径审计

| 检查 | 通过 |
| --- | --- |
| non-persistent source cannot be extracted after visible tag is gone | True |
| Z5 field pillar extraction is blocked on mechanic route | True |
| Boss core exposure keeps positive HP before final fragile strike | True |
| Boss can be finished after second visible fragile extraction | True |

## 6. 真实DOM点击回归

| 项目 | 数值 |
| --- | --- |
| 通过 | True |
| 浏览器 | chrome.exe |
| 引导完成 | True |
| 低引导完成 | True |
| 引导误操作 | 0 |
| 低引导误操作 | 0 |

## 7. 视觉Smoke

| 场景 | 通过 | 视口 | 横向溢出 | 首屏对象 | 首屏动作 | 可操作入口 | 截图 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| desktop-guided | True | 1280x900 | 0 | True | True | True | prototype/prototype_1_0_0_full.png |
| mobile-low | True | 390x844 | 0 | True | True | True | prototype/prototype_1_0_0_mobile.png |

## 8. 校验覆盖

- JSON解析与标签引用
- app/data一致性
- UI DOM合约
- 双模式回归套件
- 失败审计
- HTTP健康检查
- 玩家反馈事件与体验审计
- 真实可见路径审计
- 真实DOM点击回归
- 桌面/手机视觉Smoke
