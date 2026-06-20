# Nuist DEV

记录开发实践、项目经验与技术探索。

基于 [AstroPaper](https://github.com/satnaing/astro-paper) 主题，使用 Astro 6 + TailwindCSS v4 构建。

## 技术栈

| 类别 | 技术 |
| --- | --- |
| 框架 | [Astro 6](https://astro.build/) |
| 样式 | [TailwindCSS v4](https://tailwindcss.com/) |
| 类型检查 | [TypeScript](https://www.typescriptlang.org/) |
| 静态搜索 | [Pagefind](https://pagefind.app/) |
| 动态 OG 图 | [Satori](https://github.com/vercel/satori) + [Sharp](https://sharp.pixelplumbing.com/) |
| 部署 | [Vercel](https://vercel.com/) |
| 包管理 | [pnpm](https://pnpm.io/) |

## 项目结构

```bash
/
├── public/
│   ├── duohuo/              # 多火品牌素材
│   ├── lion/                # 修机师品牌素材
│   ├── favicon.svg
│   └── default-og.jpg
├── src/
│   ├── assets/
│   │   ├── icons/           # Tabler 图标
│   │   └── images/
│   ├── components/          # Card, GithubBookmark, Header 等组件
│   ├── content/
│   │   ├── pages/           # 静态页面（关于等）
│   │   └── posts/           # 博客文章（.mdx）
│   ├── i18n/
│   │   └── lang/            # 中文 / 英文翻译
│   ├── layouts/
│   ├── pages/
│   ├── styles/
│   ├── utils/
│   ├── config.ts
│   └── content.config.ts
├── astro-paper.config.ts     # 站点配置
├── COMMIT.md                 # 提交规范
└── astro.config.ts
```

## 本地开发

```bash
pnpm install
pnpm dev
```

开发服务器运行在 `localhost:4321`。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm install` | 安装依赖 |
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 类型检查 + 构建 + Pagefind 索引 |
| `pnpm preview` | 本地预览构建产物 |
| `pnpm format` | Prettier 格式化 |
| `pnpm lint` | ESLint 检查 |

## 文章编写

所有文章存放在 `src/content/posts/yy/mm/` 目录下，统一使用 `.mdx` 格式。

```bash
src/content/posts/26/06/my-post.mdx
```

文章 frontmatter 和 MDX 约定详见 `.agents/skills/article-frontmatter-mdx/SKILL.md`，提交规范见 [COMMIT.md](./COMMIT.md)。

### GitHub 项目文章

介绍 GitHub 项目的文章使用 `GithubBookmark` 组件渲染仓库卡片，`author` 字段设为仓库 owner 的 GitHub 用户名，并将该用户名加入标签列表。

## 部署

仓库连接 Vercel 后，每次 `main` 分支合并 PR 都会自动触发部署。

`main` 分支已启用保护规则：
- 需要 Pull Request + 1 人审批
- CI 检查必须通过
- 禁止 force push 和删除

## License

MIT
