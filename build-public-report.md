# 公开发布构建报告

- 模式：docs（完整版，含本机数据集）
- 构建时间：2026-10-10T11:19:51.277Z
- 输出目录：dist/ ，共 12 个文件
- 措辞替换总次数：159（按文件明细见 release/build-public-report.json）

## 匿名化统计

- 第三方包名统一为 community：0 个节点
- 本机溯源标识改写为 community:// ：0 处
- 已清空本机包清单与采集时间；构建期识别到的原包名：无

## 校验

| 检查 | 结果 | 命中 |
| - | - | - |
| 无 local:// 本机溯源标识残留 | 通过 | 0 |
| 无本机导出文件名残留 | 通过 | 0 |
| 无 http:// 明文资源（已排除 SVG 命名空间） | 通过 | 0 |
| 数据 meta 无本机特征词 | 通过 | 0 |
| 节点级字段无本机特征（pythonModule / 溯源） | 通过 | 0 |
| 公开版节点数 = 1024~1040（官方文档收录量级） | 通过 | 1032 |
| 公开版无本机专属字段（localInputs/localOutputs/pythonModule） | 通过 | 0 |
| 公开版 meta 无 localEnv | 通过 | 0 |

## 文件清单

- assets\app.js — 56603 B
- assets\content-data.js — 18230 B
- assets\enhance.js — 31675 B
- assets\hero.css — 18992 B
- assets\nodes-data.js — 2545521 B
- assets\style.css — 45746 B
- assets\workflow-graph.js — 16049 B
- faq.html — 21747 B
- index.html — 28181 B
- nodes.html — 5777 B
- sources.html — 15224 B
- workflows.html — 89561 B
