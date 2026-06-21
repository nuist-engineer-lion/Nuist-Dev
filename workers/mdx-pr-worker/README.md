# Nuist DEV MDX PR Worker

Cloudflare Worker 投稿入口。用户通过 GitHub OAuth 登录后提交 MDX 正文和图片附件，Worker 用仓库 Bot token 创建分支、提交文件并打开 PR。

## GitHub OAuth App

在 GitHub 创建 OAuth App：

- Homepage URL：Worker 部署后的域名
- Authorization callback URL：`https://<worker-domain>/auth/github/callback`

## Cloudflare secrets

```bash
pnpm --dir workers/mdx-pr-worker wrangler secret put GITHUB_CLIENT_ID
pnpm --dir workers/mdx-pr-worker wrangler secret put GITHUB_CLIENT_SECRET
pnpm --dir workers/mdx-pr-worker wrangler secret put GITHUB_BOT_TOKEN
pnpm --dir workers/mdx-pr-worker wrangler secret put SESSION_SECRET
```

`GITHUB_BOT_TOKEN` 需要能在 `nuist-engineer-lion/Nuist-Dev` 写 contents 并创建 pull requests。

## Local development

```bash
pnpm worker:dev
pnpm worker:typecheck
```

本地调试 OAuth 时，GitHub OAuth App 的 callback URL 需要指向 Wrangler dev 暴露的实际 URL。

## Submission rules

- `pubDatetime` 由 Worker 服务端按 `Asia/Shanghai` 当前日期生成，表单和 API 都不接受客户端传入发布日期。
- 文章写入 `src/content/posts/yy/mm/{slug}.mdx`。
- 附件写入 `public/uploads/posts/yy/mm/{slug}/`。
- 附件只支持 `png`、`jpg`、`jpeg`、`webp`、`avif`、`gif`、`svg`。
- 正文使用 `{{file:name.png}}` 引用附件；提交时会替换成 public 绝对路径。
- 新文章默认 `draft: true`，合并前由维护者审核。
