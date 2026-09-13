# 进球时刻 3D · 空间智能开发

将球员动作、球场空间与球星卡和摆件设计结合的三维项目交付包。

**[下载全部交付资料](https://github.com/bnj-apl/goal-moment-3d/releases/latest)**

## 选择你需要的内容

| 文件 | 大小 | 下载 |
| --- | --- | --- |
| 空间智能开发-进球时刻.zip | 1,328.7 MB | [下载](https://github.com/bnj-apl/goal-moment-3d/releases/download/v2026.09.13/goal-moment-3d-project.zip) |
| 进球时刻3D.mp4 | 6.2 MB | [下载](https://github.com/bnj-apl/goal-moment-3d/releases/download/v2026.09.13/goal-moment-3d-demo.mp4) |
| 进球时刻3D_素材与技术（最终交付） 9.13.pdf | 42.5 MB | [下载](https://github.com/bnj-apl/goal-moment-3d/releases/download/v2026.09.13/goal-moment-3d-materials-and-technology.pdf) |
| 进球时刻3D_项目报告书.pdf | 2.5 MB | [下载](https://github.com/bnj-apl/goal-moment-3d/releases/download/v2026.09.13/goal-moment-3d-project-report.pdf) |

下载文件采用英文名称，内容与原始中文文件一致。完整项目约 1.33 GB，包含源码、模型、素材及本地预览入口。

## 体验 Demo

1. 想快速了解效果，先下载演示视频；项目介绍和技术交付内容分别见两份 PDF。
2. 下载上表中的完整项目 ZIP，并完整解压。
3. 在解压后的「空间智能开发-队友交接版」目录打开终端，运行：

```sh
python3 启动交接预览.py
```

Windows 如未识别 `python3`，可运行 `py -3 启动交接预览.py`。

4. 在浏览器打开终端显示的本机网址，并保持终端运行。从入口进入项目方案、五款三维产品、人物展厅和球场查看器。

普通预览需要 Python 3 和支持 WebGL 2 的现代浏览器，无需 Aholo API 密钥。需加载模型的网页应通过本地服务打开。

这是下载后在本机运行的项目；GitHub 仓库链接本身不是在线 3D Demo。请从 Releases 下载上表中的项目包，GitHub 自动生成的 Source code 压缩包只含此仓库的说明文件。

## 继续开发

先阅读完整项目包根目录的 `00-交接说明.md`、`01-未包含资料.md` 和 `02-脱敏与校验说明.md`，其中记录了目录依赖、再生成方法及验证边界。

包含五款三维产品、两组四动作人物模型与展厅、球场 PLY/SPZ、查看器、主要构建器及精选技术资料。云服务需使用接收者自己的账号和凭据；人物替换、模型质量及制造验收状态以包内交接说明为准。

## 文件校验

本次分享日期：2026-09-13。`SHA256SUMS.txt` 提供下载文件的 SHA-256 校验值，`files.json` 记录原文件名、下载文件名和字节数。

包内第三方来源与许可证说明随原交付包保留。
