---
title: "PR 投稿"
description: "通过 Pull Request 投稿、修正文章和提交项目介绍的入口。"
---

## 投稿方式

这个站点采用 PR 发帖。你可以直接把文章文件放到 `src/content/posts/yy/mm/`，然后提交 Pull Request。

## 适合提交的内容

- 新文章
- 文章修订
- 错别字、链接和格式修正
- GitHub 项目介绍

## 文章规则

- 文章统一使用 `.mdx`
- 路径必须是 `src/content/posts/yy/mm/`
- frontmatter 至少包含 `title`、`description`、`pubDatetime`
- GitHub 项目文章要补 `author`，并在标签里加上作者名
- 项目介绍正文顶部使用 `GithubBookmark`

## 提交步骤

1. Fork 仓库并创建分支
2. 新建或修改文章文件
3. 本地运行 `pnpm build`
4. 发起 Pull Request

## 仓库入口

- [打开 GitHub 仓库](https://github.com/nuist-engineer-lion/Nuist-Dev)
- [查看 Pull Request 模板](https://github.com/nuist-engineer-lion/Nuist-Dev/blob/main/.github/PULL_REQUEST_TEMPLATE.md)
