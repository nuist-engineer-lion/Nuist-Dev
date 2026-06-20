---
name: article-frontmatter-mdx
description: 用于创建、导入或编辑 MDX 博客文章时生成或清理 YAML frontmatter，包括标题、标签、描述、slug、发布时间、posts/yy/mm 存放位置检查、内容集合 schema 校验，以及 GitHub 项目文章的作者字段和 GithubBookmark 组件约定。
---

# 文章 Frontmatter 与 MDX 约定

## 概览

本站点所有文章统一使用 `.mdx`，不写 `.md`。新建文章时直接以 `.mdx` 创建，已有 `.md` 文章在下次编辑时升级为 `.mdx`。

根据文章正文和内容 schema 生成 frontmatter，检查文章是否放在正确的 `posts/yy/mm/` 目录下，并按约定填入 `author` 和 `tags`。

## 示例参考

本 skill 带有 AstroPaper 示例文章，位于 `examples/`，全部为 `.mdx`。当需要判断 frontmatter 风格、组件导入写法或正文结构时，读取这些示例。

- `examples/adding-new-post.mdx`：优先参考，包含 AstroPaper 新文章规则、frontmatter 示例和 MDX 组件导入案例。
- `examples/how-to-configure-astropaper-theme.mdx`、`examples/customizing-astropaper-theme-color-schemes.mdx`、`examples/_color-schemes/predefined-color-schemes.mdx`：参考正文使用 `import ResponsiveTable` 和组件时的写法。
- `examples/*.mdx`：可用于观察字段顺序、日期格式、`tags` 块状列表、`slug`、`featured`、`draft`、`ogImage`、`canonicalURL` 等字段风格。

不要读取 `examples/_color-schemes/assets/` 下的图片资产，除非用户明确要求检查图片。

## 工作流程

1. 读取目标文章和控制文章结构的项目配置。优先查看 `content.config.ts`、`src/content.config.ts`、`astro.config.*`、相邻文章，以及项目里的发文说明。
2. 识别文章根目录。AstroPaper 项目通常是 `src/content/posts`；其他项目以本地 schema 或已有文章目录为准。
3. 检查文章路径是否符合 `posts/yy/mm/文件名.mdx`。`yy` 是两位年份，`mm` 是两位月份。
4. 从 schema 和本地示例中推断必填字段、可选字段、字段顺序和写法。保留已有字段，除非字段为空、无效，或明显不符合文章内容。
5. 阅读足够多的正文，判断文章真实主题、目标读者、核心名词和发布意图。不要只根据文件名生成标签或描述。
6. 如果文章介绍的是 GitHub 上的项目，按下方「GitHub 项目文章约定」填入 `author` 和 `tags`，并在正文顶部使用 `GithubBookmark` 组件。
7. 按项目现有风格生成 YAML frontmatter。
8. 使用最小补丁编辑文件。已有 `.md` 文章升级为 `.mdx` 时，同步更新直接指向旧路径或旧扩展名的内部链接、导入和索引引用。
9. 使用范围最窄的可用命令验证：内容 schema 检查、框架检查、构建检查，或至少执行 YAML/frontmatter 解析和 diff 复查。

## 文章存放位置规则

文章应放在项目的 posts 根目录下，并按发布时间分到 `yy/mm` 子目录：

```text
src/content/posts/26/03/文章标题.mdx
```

检查路径时按这个顺序取日期：

1. 已有 frontmatter 中的 `pubDatetime`、`date` 或 `publishedAt`。
2. 文件路径中已有的 `yy/mm`。
3. 用户明确提供的发布日期。
4. 创建新可发布文章时，才使用当前日期。

如果文章不在 `posts/yy/mm/` 下：

- 能从发布时间明确推导目录时，移动到对应目录。
- 不能确定发布日期时，先补齐或询问日期，不要随意用当前日期覆盖。
- 移动文件后保留原文件名，除非用户要求改名。
- 同步更新项目内直接引用旧路径的链接、导入、索引或文档入口。
- 如果项目使用不同 posts 根目录，以 schema 和已有文章结构为准，但仍保持 `yy/mm` 分层。

## Frontmatter 规则

先遵循项目 schema。schema 不存在或约束较松时，使用下面的默认规则：

| 字段 | 规则 |
| --- | --- |
| `title` | 使用文章真实标题。优先取正文第一个 H1，其次取文件名。去掉草稿前缀和重复日期。 |
| `description` | 写一句具体摘要。中文通常 70 到 160 字符，英文通常 120 到 180 字符。描述具体主题，不写泛泛的价值判断。 |
| `tags` | 使用 2 到 5 个具体标签。优先复用站点已有分类。避免 `docs`、`notes`、`misc`、`AI` 这类过宽标签，除非项目本来就有意这样用。 |
| `slug` | 保留已有稳定 slug。新文章的 slug 按本地示例生成；除非用户要求，不要随意改 URL。 |
| `pubDatetime`、`date`、`publishedAt` | 保留已有发布时间。新文章优先使用用户提供的日期、路径中编码的日期；只有创建可发布文章时才使用当前日期。 |
| `modDatetime`、`updatedAt` | 保留已有值，除非项目要求或用户要求刷新元数据。 |
| `author` | 见下方「GitHub 项目文章约定」。非项目文章保留已有值；未设置时使用 schema 默认值。 |
| `draft`、`featured`、`canonicalURL`、`ogImage` | 保留已有值。只有 schema 必填或相邻示例固定使用时才新增。 |

当本地风格使用块状列表时，标签也使用块状列表：

```yaml
tags:
  - Rust
  - Windows
  - faithleysath
description: "一句具体描述文章内容的摘要。"
```

包含 `:`、`#`、`{}`、`[]`、开头标点，或可能被 YAML 误读的字符串，要加引号。布尔值和日期不要加引号，除非本地示例一直这样写。

## GitHub 项目文章约定

当文章介绍的是 GitHub 上的项目时，`author` 和 `tags` 按以下规则填写：

| 字段 | 规则 |
| --- | --- |
| `author` | 使用仓库 owner 的 GitHub 用户名，例如 `faithleysath`。不要用站点默认作者名。 |
| `tags` | 在标签列表中加入 author 字段的值，让读者可以按作者筛选。其他标签仍按具体技术名词选取。 |

正文顶部使用 `GithubBookmark` 组件展示仓库卡片：

```mdx
---
author: faithleysath
pubDatetime: 2026-06-20T12:00:00+08:00
title: Remote Control for Windows 项目介绍
slug: remote-control-for-windows-intro
featured: true
draft: false
tags:
  - Rust
  - Windows
  - 远程协助
  - MCP
  - faithleysath
description: "一套临时、可见、可审计的 Windows 远程协助工具。"
---
import GithubBookmark from '@/components/GithubBookmark.astro';

<GithubBookmark
  owner="faithleysath"
  repo="remote-control-for-windows"
  url="https://github.com/faithleysath/remote-control-for-windows"
  description="临时、可见、可审计的 Windows 远程协助工具"
  language="Rust"
  languageColor="#dea584"
  stars={0}
  forks={0}
  license="GPL-3.0"
/>
```

`GithubBookmark` 的 props：`owner`、`repo`、`url`、`description`、`language`、`languageColor`、`stars`、`forks`、`license`。除 `owner`、`repo`、`url` 外，其余可选。仓库元数据从 GitHub README 或 API 取真实值，不要编造 Star、Fork 或 License。

## 扩展名

所有文章使用 `.mdx`。

- 新建文章直接以 `.mdx` 创建。
- 已有 `.md` 文章在下次编辑时重命名为 `.mdx`，frontmatter 之后加一行 `import` 或组件即可触发升级理由。
- 重命名前确认项目支持 MDX。Astro 项目检查 `package.json` 或 `astro.config.*` 中是否存在 `@astrojs/mdx`。

## 质量检查

- 标签必须具体、可检索。优先使用读者会在标签页里搜索的名词。
- GitHub 项目文章必须包含 author 用户名作为一个标签。
- 描述要自然、具体，不写宣传腔。避免"深入探讨""全面解析""本文介绍""vibrant""crucial"等填充式表达，除非作者风格明确如此。
- 不编造正文没有出现的事实、日期、来源、产品名或结论。`GithubBookmark` 的 Star、Fork、License 等元数据从仓库真实信息取值。
- 除非用户要求，否则不要改正文。
- 没有明确理由时，不要改变 `draft`、`featured`、canonical URL 或已有 slug。
- 如果 schema 校验失败，先修元数据。不要为了让一篇文章通过而放宽 schema。

## 回复格式

编辑完成后报告：

1. 修改的文件路径（含扩展名）。
2. 存放位置检查：`位置正确`、`已移动到 posts/yy/mm`，或 `需要日期才能确定位置`。
3. 最终 `author`、`tags` 和 `description`。
4. GitHub 项目文章检查：`已使用 GithubBookmark 组件` 或 `非项目文章`。
5. 扩展名检查：`已是 .mdx` 或 `已从 .md 升级为 .mdx`。
6. 验证命令和结果。
