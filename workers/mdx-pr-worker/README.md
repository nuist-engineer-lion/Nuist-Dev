# Nuist DEV MDX PR Worker

Cloudflare Worker 投稿入口。用户通过 GitHub App 的 OAuth 登录后提交 MDX 正文和图片附件，Worker 用该 App 的安装令牌创建分支、提交文件并打开 PR。commit 作者归属为投稿者，PR 由 App 发起。

## GitHub App

创建一个 GitHub App，同时承担用户 OAuth 登录与仓库写入：

- Homepage URL：Worker 部署后的域名
- Authorization callback URL：`https://<worker-domain>/auth/github/callback`
- 仓库权限：`Contents`（读写）、`Pull requests`（写）
- 安装到 `nuist-engineer-lion/Nuist-Dev`，记录 App ID、私钥、Installation ID

## Cloudflare secrets

```bash
pnpm --dir workers/mdx-pr-worker wrangler secret put GITHUB_CLIENT_ID
pnpm --dir workers/mdx-pr-worker wrangler secret put GITHUB_CLIENT_SECRET
pnpm --dir workers/mdx-pr-worker wrangler secret put GITHUB_APP_ID
pnpm --dir workers/mdx-pr-worker wrangler secret put GITHUB_APP_PRIVATE_KEY
pnpm --dir workers/mdx-pr-worker wrangler secret put GITHUB_APP_INSTALLATION_ID
pnpm --dir workers/mdx-pr-worker wrangler secret put SESSION_SECRET
pnpm --dir workers/mdx-pr-worker wrangler secret put IMGBED_TOKEN
```

`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` 取自同一个 GitHub App（替换旧的独立 OAuth App）。
`GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` / `GITHUB_APP_INSTALLATION_ID` 用于签发 Installation Access Token（1 小时有效、自动轮换）。App 需对 `nuist-engineer-lion/Nuist-Dev` 拥有 `Contents` 写权限并创建 pull requests。提交的 commit 作者为投稿用户（`id+login@users.noreply.github.com`），PR 发起者为 App。

## Local development

```bash
pnpm worker:dev
pnpm worker:typecheck
```

本地调试 OAuth 时，GitHub App 的 callback URL 需要指向 Wrangler dev 暴露的实际 URL。

## Submission rules

- `pubDatetime` 由 Worker 服务端按 `Asia/Shanghai` 当前日期生成，表单和 API 都不接受客户端传入发布日期。
- 文章写入 `src/content/posts/yy/mm/{slug}.mdx`。
- 附件上传到独立图床 `https://imgbed.nuist.dev/`。
- 附件只支持 `png`、`jpg`、`jpeg`、`webp`、`avif`、`gif`、`svg`。
- 正文使用 `{{file:name.png}}` 引用附件；提交时会替换成图床绝对 URL。
- 新文章默认 `draft: true`，合并前由维护者审核。

## Image bed

- Worker 会把附件转发到 `IMGBED_URL`，默认是 `https://imgbed.nuist.dev`。
- 上传时会带 `X-Upload-Token: <IMGBED_TOKEN>`。
- 默认目录前缀为 `posts`，实际上传目录为 `posts/YYYY/MM/{slug}`。
