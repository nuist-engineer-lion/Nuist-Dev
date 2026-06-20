# Git 提交规范

本仓库使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范，配合 [Commitizen](https://commitizen-tools.github.io/commitizen/) 工具链。所有提交必须按以下格式书写。

---

## 快速开始

```bash
# 方式一：交互式生成（推荐）
pnpm dlx cz

# 方式二：直接书写
git commit -m "type(scope): 简要描述"
```

---

## 提交格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 完整示例

```
feat(card): 新增文章作者展示与 GitHub 书签卡片

- 新增 GithubBookmark.astro 组件，在 MDX 文章中渲染 GitHub 仓库卡片
- 新增 IconUser.svg 图标，文章卡片和文章页展示作者名称
- 新增 Remote Control for Windows 项目介绍文章（.mdx）
- 文章 author 字段设为 GitHub 用户名（faithleysath），并加入标签列表
- 修机师品牌卡片 emoji 替换为 logo 图片（public/lion/）
- 导航栏「文章」改为「项目」，置顶标签改为「置顶项目」
- article-frontmatter-mdx skill 更新为 MDX 优先，补充作者字段约定
- .gitignore 新增 .vercel/ 和 .playwright-mcp/

Closes #12
```

---

## 字段说明

### type（必填）

提交类型，全小写。可选值：

| type | 含义 | 使用场景 |
| --- | --- | --- |
| `feat` | 新功能 | 新增组件、页面、功能、文章 |
| `fix` | 修复 | 修复 Bug、错误行为 |
| `docs` | 文档 | 仅修改文档、skill、README |
| `style` | 格式 | 代码格式调整（空白、分号等），不改逻辑 |
| `refactor` | 重构 | 既不是新增功能也不是修复的代码变更 |
| `perf` | 性能 | 提升性能的改动 |
| `test` | 测试 | 新增或修改测试 |
| `build` | 构建 | 构建系统、依赖、Docker、CI 配置 |
| `ci` | CI | GitHub Actions、Vercel 配置变更 |
| `chore` | 杂务 | 不属于以上类型的改动（如 .gitignore） |
| `revert` | 回退 | 撤销某次提交 |
| `bump` | 版本 | 版本号升级 |

### scope（可选）

改动范围，全小写，用括号包裹。建议使用模块或目录名：

```
feat(card): ...          # src/components/Card.astro
feat(i18n): ...          # src/i18n/
fix(layout): ...         # src/layouts/
docs(skill): ...         # .agents/skills/
build(deps): ...         # 依赖升级
chore(gitignore): ...    # .gitignore
```

### subject（必填）

简要描述，**中文或英文均可**，但同一仓库内应保持一致。本仓库统一使用**中文**。

规则：
- 不超过 50 个字符
- 不以句号结尾
- 使用祈使语气（「新增…」「修复…」），不写「新增了…」
- 首字不大写（中文不适用，英文 type 后的描述小写开头）

### body（可选但强烈推荐）

**详细列出本次提交的修改内容与目的。** 这是本仓库的重点要求。

规则：
- 每行不超过 72 个字符
- 使用无序列表（`-`）逐条说明改了什么、为什么改
- 如有多类改动，可分组书写
- 与 subject 之间空一行

**写法要求：**

```text
# 好 — 写清楚「改了什么」和「为什么」
- 新增 GithubBookmark 组件，让 GitHub 项目文章有统一的仓库信息卡片
- 文章 author 字段设为 GitHub 用户名，与仓库 owner 保持一致

# 差 — 只写「改了什么」，看不出目的
- 加了 GithubBookmark 组件
- 改了 author 字段

# 差 — 太笼统
- 更新了组件
- 修改了配置
```

### footer（可选）

用于引用 Issue、PR、标注破坏性变更。

```
Closes #42
PR #55
BREAKING CHANGE: i18n 结构从文件式改为目录式，需要重新运行 pnpm sync
```

---

## 破坏性变更

在 type 后加 `!`，或在 footer 中写 `BREAKING CHANGE:`：

```
feat!: i18n 目录结构改为 lang/ 子目录

- 原 src/i18n/en.ts 移至 src/i18n/lang/en.ts
- 新增 src/i18n/lang/zh.ts 中文翻译
- 所有 import 路径需同步更新

BREAKING CHANGE: i18n 模块路径变更，现有代码需更新 import
```

---

## 常见场景示例

### 新增文章

```
feat(post): 新增 Remote Control for Windows 项目介绍

- 介绍 faithleysath/remote-control-for-windows 项目
- 涵盖架构、安全模型、MCP 模式和快速开始
- author 设为 GitHub 用户名 faithleysath，标签含 Rust、Windows、MCP
- 使用 GithubBookmark 组件渲染仓库卡片
```

### 新增组件

```
feat(component): 新增 GithubBookmark 组件

- 在 MDX 文章中渲染 GitHub 仓库信息卡片
- 支持 owner、repo、description、language、stars、forks、license 等 props
- 使用站点主题 token，适配浅色/深色双主题
- 替代原来的 callout 链接写法，视觉一致性更好
```

### 修复 Bug

```
fix(card): 修复作者名称在窄屏不换行的问题

- Datetime 和 author 容器改用 flex-wrap
- 窄屏时作者名称自动换到下一行，不再溢出
```

### 依赖升级

```
build(deps): 升级 astro 至 6.4.2

- astro 6.3.0 → 6.4.2
- @astrojs/mdx 6.0.0 → 6.0.1
- 修复 content collection 类型推断问题
```

### 仅文档

```
docs(skill): 更新 article-frontmatter-mdx 为 MDX 优先

- 所有新文章统一使用 .mdx，不再写 .md
- 新增 GitHub 项目文章的 author 和 tags 约定
- 新增 GithubBookmark 组件使用示例
- 删除 examples/ 下所有 .md 文件，仅保留 .mdx
```

---

## 禁止事项

- **不要写 `update`、`fix bug`、`修改` 这类无信息量的 message**
- **不要只写文件名**（`fix: Card.astro`）
- **不要在一次提交中混合不相关的改动**——拆成多次提交
- **不要在 subject 中写 Issue 编号**——放到 footer
- **不要在 commit message 末尾加句号**

---

## Commitizen 配置

本仓库通过 `cz.yaml` 配置 Commitizen：

```yaml
commitizen:
  name: cz_conventional_commits
  tag_format: v$version
  update_changelog_on_bump: true
  version_provider: npm
  version_scheme: semver
```

版本号跟随 `package.json` 的 `version` 字段。发布新版本时：

```bash
pnpm dlx cz bump              # 自动版本号 + CHANGELOG
pnpm dlx cz bump --dry-run    # 预览不执行
pnpm dlx cz changelog         # 仅生成 CHANGELOG
pnpm dlx cz check              # 检查最近一条提交是否符合规范
```

---

## 提交前检查清单

每次提交前确认：

- [ ] type 正确（feat / fix / docs / chore …）
- [ ] scope 能准确描述改动范围（可省略）
- [ ] subject 简洁，说明「做了什么」
- [ ] body 逐条写明改了什么、为什么改
- [ ] 没有混合不相关的改动
- [ ] 关联的 Issue / PR 写在 footer
