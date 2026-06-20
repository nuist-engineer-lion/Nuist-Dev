# AGENTS.md

本文件为在此仓库工作的 AI agent 提供上下文。

## 项目概况

Nuist DEV 是一个基于 Astro 6 的中文技术博客与项目展示站点。基于 AstroPaper 主题深度定制。

- 站点语言：中文（`src/i18n/lang/zh.ts`）
- 时区：`Asia/Shanghai`
- 部署：Vercel，push `main` 自动部署

## 开发命令

```bash
pnpm install          # 安装依赖
pnpm dev              # 开发服务器 localhost:4321
pnpm build            # 类型检查 + 构建 + pagefind 索引
pnpm preview          # 预览构建产物
pnpm format           # Prettier 格式化
pnpm lint             # ESLint
pnpm sync             # 生成 Astro 类型
```

## 关键约定

### 文章

- 所有文章用 `.mdx`，不写 `.md`
- 存放于 `src/content/posts/yy/mm/`（两位年份/月份）
- Frontmatter 规则、MDX 判断、GitHub 项目文章约定详见 `.agents/skills/article-frontmatter-mdx/SKILL.md`
- **GitHub 项目文章**：`author` 设为仓库 owner 的 GitHub 用户名，标签列表包含该用户名，正文顶部用 `GithubBookmark` 组件

### 提交

- 遵循 Conventional Commits，详见 [COMMIT.md](./COMMIT.md)
- message 用中文，body 必须写明改了什么和为什么

### Git 流程

- `main` 受保护：需要 PR + 1 人审批才能合并
- 禁止 force push 和删除 `main`
- 合并后自动删除源分支
- 切功能分支开发：`git checkout -b <type>/<desc>`

## 项目结构要点

| 路径 | 用途 |
| --- | --- |
| `astro-paper.config.ts` | 站点配置（标题、作者、时区、功能开关） |
| `src/content.config.ts` | 文章/页面 schema 定义 |
| `src/i18n/lang/zh.ts` | 中文翻译（导航、标签、提示文案） |
| `src/components/GithubBookmark.astro` | GitHub 仓库书签卡片组件 |
| `src/components/Card.astro` | 文章列表卡片（含作者展示） |
| `src/assets/icons/` | Tabler 图标（SVG） |
| `public/duohuo/` | 多火品牌素材 |
| `public/lion/` | 修机师品牌素材 |
| `.agents/skills/` | 技能文档 |

## 设计 token

主题色定义在 `src/styles/theme.css`，通过 `@theme inline` 注册为 Tailwind v4 变量：

| Token | 用途 |
| --- | --- |
| `--background` / `--foreground` | 背景/前景 |
| `--accent` / `--accent-foreground` | 强调色 |
| `--muted` / `--muted-foreground` | 次要色 |
| `--border` | 边框 |

浅色/深色通过 `[data-theme="light"]` / `[data-theme="dark"]` 切换。

## 图标

使用 [Tabler Icons](https://tabler-icons.io/)，SVG 文件放在 `src/assets/icons/`，命名 `Icon{Name}.svg`，在 `.astro` 中作为组件导入：

```astro
import IconUser from "@/assets/icons/IconUser.svg";
<IconUser class="size-5" />
```
