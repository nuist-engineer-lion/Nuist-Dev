/// <reference types="@cloudflare/workers-types" />

type Env = {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_BOT_TOKEN: string;
  SESSION_SECRET: string;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
  BASE_BRANCH?: string;
  TIMEZONE?: string;
};

type GitHubUser = {
  id: number;
  login: string;
  avatar_url?: string;
  name?: string | null;
};

type Session = {
  id: number;
  login: string;
  avatarUrl?: string;
  name?: string | null;
  iat: number;
  exp: number;
};

type DateParts = {
  yyyy: string;
  yy: string;
  mm: string;
  dd: string;
  yyyymmdd: string;
};

type Attachment = {
  originalName: string;
  safeName: string;
  mime: string;
  size: number;
  publicPath: string;
  repoPath: string;
  bytes: Uint8Array;
};

type RepoFile = {
  path: string;
  content: Uint8Array;
};

const SESSION_COOKIE = "nuist_mdx_session";
const STATE_COOKIE = "nuist_mdx_oauth_state";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const STATE_MAX_AGE_SECONDS = 60 * 10;
const MAX_ATTACHMENTS = 8;
const MAX_ATTACHMENT_SIZE = 3 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_SIZE = 12 * 1024 * 1024;
const MAX_BODY_SIZE = 256 * 1024;
const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

const MIME_BY_EXTENSION: Record<string, readonly string[]> = {
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  avif: ["image/avif"],
  gif: ["image/gif"],
  svg: ["image/svg+xml"],
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      const message =
        error instanceof HttpError
          ? error.message
          : "服务器处理投稿时出现异常。";
      const status = error instanceof HttpError ? error.status : 500;
      return wantsJson(request)
        ? json({ ok: false, error: message }, status)
        : html(renderErrorPage(message), status);
    }
  },
};

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  if (request.method === "GET" && pathname === "/") {
    const session = await readSession(request, env);
    return html(renderHomePage(session));
  }

  if (request.method === "GET" && pathname === "/auth/github") {
    return startGitHubOAuth(request, env);
  }

  if (request.method === "GET" && pathname === "/auth/github/callback") {
    return finishGitHubOAuth(request, env);
  }

  if (request.method === "POST" && pathname === "/api/submit") {
    const session = await requireSession(request, env);
    const result = await handleSubmit(request, env, session);
    return json({ ok: true, ...result });
  }

  if (request.method === "POST" && pathname === "/logout") {
    return redirect("/", [
      clearCookie(SESSION_COOKIE),
      clearCookie(STATE_COOKIE),
    ]);
  }

  return html(renderErrorPage("页面不存在。"), 404);
}

async function startGitHubOAuth(
  request: Request,
  env: Env
): Promise<Response> {
  requireEnv(env, [
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "SESSION_SECRET",
  ]);

  const state = await createSignedToken(
    {
      nonce: randomHex(16),
      iat: nowSeconds(),
      exp: nowSeconds() + STATE_MAX_AGE_SECONDS,
    },
    env.SESSION_SECRET
  );
  const origin = new URL(request.url).origin;
  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", `${origin}/auth/github/callback`);
  authUrl.searchParams.set("scope", "read:user");
  authUrl.searchParams.set("state", state);

  return redirect(authUrl.toString(), [
    cookie(STATE_COOKIE, state, STATE_MAX_AGE_SECONDS),
  ]);
}

async function finishGitHubOAuth(
  request: Request,
  env: Env
): Promise<Response> {
  requireEnv(env, [
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "SESSION_SECRET",
  ]);

  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const cookies = parseCookies(request.headers.get("Cookie") ?? "");
  const stateCookie = cookies.get(STATE_COOKIE) ?? "";

  if (!state || !code || state !== stateCookie) {
    throw new HttpError(400, "GitHub 登录状态已失效，请重新登录。");
  }

  const statePayload = await verifySignedToken<{
    nonce: string;
    iat: number;
    exp: number;
  }>(state, env.SESSION_SECRET);
  if (!statePayload || statePayload.exp < nowSeconds()) {
    throw new HttpError(400, "GitHub 登录状态已过期，请重新登录。");
  }

  const tokenResponse = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${url.origin}/auth/github/callback`,
      }),
    }
  );
  const tokenBody = await tokenResponse.json<{
    access_token?: string;
    error_description?: string;
  }>();

  if (!tokenResponse.ok || !tokenBody.access_token) {
    throw new HttpError(
      400,
      tokenBody.error_description ?? "无法完成 GitHub 登录。"
    );
  }

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${tokenBody.access_token}`,
      "User-Agent": "Nuist-Dev-MDX-PR-Worker",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!userResponse.ok) {
    throw new HttpError(400, "无法读取 GitHub 用户信息。");
  }

  const user = await userResponse.json<GitHubUser>();
  const session: Session = {
    id: user.id,
    login: user.login,
    avatarUrl: user.avatar_url,
    name: user.name ?? null,
    iat: nowSeconds(),
    exp: nowSeconds() + SESSION_MAX_AGE_SECONDS,
  };
  const sessionToken = await createSignedToken(session, env.SESSION_SECRET);

  return redirect("/", [
    cookie(SESSION_COOKIE, sessionToken, SESSION_MAX_AGE_SECONDS),
    clearCookie(STATE_COOKIE),
  ]);
}

async function handleSubmit(
  request: Request,
  env: Env,
  session: Session
): Promise<{
  pullRequestUrl: string;
  articlePath: string;
  attachmentPaths: string[];
  branch: string;
}> {
  requireEnv(env, [
    "GITHUB_BOT_TOKEN",
    "GITHUB_OWNER",
    "GITHUB_REPO",
    "BASE_BRANCH",
    "SESSION_SECRET",
  ]);

  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    throw new HttpError(415, "投稿请求必须使用 multipart/form-data。");
  }

  const form = await request.formData();
  if (form.has("pubDate") || form.has("pubDatetime")) {
    throw new HttpError(400, "发布日期由服务器生成，不能从客户端提交。");
  }

  const dates = getShanghaiDateParts(env.TIMEZONE ?? "Asia/Shanghai");
  const title = requiredText(form, "title", "标题");
  const description = requiredText(form, "description", "描述");
  const tags = parseTags(requiredText(form, "tags", "标签"));
  const author = text(form, "author").trim() || session.login;
  const body = requiredText(form, "body", "正文");
  const slug = normalizeSlug(text(form, "slug")) || fallbackSlug(title, dates);
  const coverAttachment = text(form, "coverAttachment").trim();

  validateArticleInput({
    title,
    description,
    tags,
    author,
    slug,
    body,
  });

  const yy = dates.yy;
  const mm = dates.mm;
  const attachmentBasePath = `/uploads/posts/${yy}/${mm}/${slug}`;
  const attachments = await parseAttachments(
    form,
    `public${attachmentBasePath}`,
    attachmentBasePath
  );
  const { body: bodyWithAttachmentPaths, coverPath } =
    resolveAttachmentReferences(body, attachments, coverAttachment);

  const articlePath = `src/content/posts/${yy}/${mm}/${slug}.mdx`;
  const articleContent = buildMdx({
    author,
    pubDatetime: `${dates.yyyy}-${dates.mm}-${dates.dd}T12:00:00+08:00`,
    title,
    slug,
    tags,
    description,
    ogImage: coverPath,
    body: bodyWithAttachmentPaths,
  });
  const files: RepoFile[] = [
    { path: articlePath, content: ENCODER.encode(articleContent) },
    ...attachments.map(attachment => ({
      path: attachment.repoPath,
      content: attachment.bytes,
    })),
  ];

  const branch = `post/${dates.yyyymmdd}-${slug}-${randomHex(4)}`;
  const pullRequest = await createPullRequestWithFiles(env, {
    branch,
    title: `docs: 添加投稿《${title}》`,
    commitMessage: `docs: 添加投稿《${title}》`,
    body: buildPullRequestBody({
      submitter: session.login,
      articlePath,
      attachmentPaths: attachments.map(attachment => attachment.repoPath),
      coverPath,
      tags,
      description,
    }),
    files,
  });

  return {
    pullRequestUrl: pullRequest.html_url,
    articlePath,
    attachmentPaths: attachments.map(attachment => attachment.repoPath),
    branch,
  };
}

function renderHomePage(session: Session | null): string {
  const userBlock = session
    ? `<div class="user">
        ${
          session.avatarUrl
            ? `<img src="${escapeAttr(session.avatarUrl)}" alt="" />`
            : ""
        }
        <span>@${escapeHtml(session.login)}</span>
        <form method="post" action="/logout"><button type="submit">退出</button></form>
      </div>`
    : "";

  const content = session
    ? renderSubmitForm(session)
    : `<section class="panel center">
        <h1>Nuist DEV 投稿</h1>
        <p>使用 GitHub 登录后提交 MDX 草稿，系统会自动创建 Pull Request。</p>
        <a class="primary" href="/auth/github">使用 GitHub 登录</a>
      </section>`;

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Nuist DEV 投稿</title>
    <style>${CSS}</style>
  </head>
  <body>
    <main>
      ${userBlock}
      ${content}
    </main>
  </body>
</html>`;
}

function renderSubmitForm(session: Session): string {
  return `<section class="panel">
    <h1>提交 MDX 草稿</h1>
    <form id="submit-form" method="post" action="/api/submit" enctype="multipart/form-data">
      <label>
        <span>标题</span>
        <input name="title" required maxlength="120" autocomplete="off" />
      </label>
      <label>
        <span>Slug</span>
        <input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="my-post-title" autocomplete="off" />
      </label>
      <label>
        <span>作者</span>
        <input name="author" required value="${escapeAttr(session.login)}" autocomplete="off" />
      </label>
      <label>
        <span>标签</span>
        <textarea name="tags" required rows="3" placeholder="Astro, Cloudflare, 投稿"></textarea>
      </label>
      <label>
        <span>描述</span>
        <textarea name="description" required rows="3" maxlength="220"></textarea>
      </label>
      <label>
        <span>正文 MDX</span>
        <textarea class="body" name="body" required rows="18" placeholder="正文里用 {{file:diagram.png}} 引用上传图片。"></textarea>
      </label>
      <label>
        <span>图片附件</span>
        <input id="attachments" name="attachments" type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif,image/svg+xml" multiple />
      </label>
      <label>
        <span>封面图</span>
        <select id="coverAttachment" name="coverAttachment">
          <option value="">不设置</option>
        </select>
      </label>
      <button class="primary" type="submit">提交 Pull Request</button>
    </form>
    <output id="result" aria-live="polite"></output>
  </section>
  <script>
    const form = document.querySelector("#submit-form");
    const attachments = document.querySelector("#attachments");
    const cover = document.querySelector("#coverAttachment");
    const result = document.querySelector("#result");

    attachments.addEventListener("change", () => {
      const files = Array.from(attachments.files || []);
      cover.replaceChildren(new Option("不设置", ""));
      for (const file of files) cover.append(new Option(file.name, file.name));
    });

    form.addEventListener("submit", async event => {
      event.preventDefault();
      result.className = "";
      result.textContent = "正在提交...";
      const response = await fetch("/api/submit", {
        method: "POST",
        body: new FormData(form),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        result.className = "error";
        result.textContent = data.error || "提交失败。";
        return;
      }
      result.className = "success";
      result.innerHTML = '已创建 PR：<a href="' + data.pullRequestUrl + '" rel="noreferrer" target="_blank">' + data.pullRequestUrl + "</a>";
      form.reset();
      cover.replaceChildren(new Option("不设置", ""));
    });
  </script>`;
}

function renderErrorPage(message: string): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Nuist DEV 投稿</title>
    <style>${CSS}</style>
  </head>
  <body>
    <main>
      <section class="panel center">
        <h1>请求失败</h1>
        <p>${escapeHtml(message)}</p>
        <a class="primary" href="/">返回首页</a>
      </section>
    </main>
  </body>
</html>`;
}

const CSS = `
:root {
  color-scheme: light dark;
  --background: #f6f7f8;
  --foreground: #182026;
  --muted: #59636e;
  --panel: #ffffff;
  --border: #d7dde3;
  --accent: #0f766e;
  --accent-foreground: #ffffff;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --background: #101417;
    --foreground: #eef2f5;
    --muted: #a4adb7;
    --panel: #171d21;
    --border: #303a42;
    --accent: #2dd4bf;
    --accent-foreground: #05201d;
  }
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: var(--background);
  color: var(--foreground);
}
main {
  width: min(960px, calc(100vw - 32px));
  margin: 32px auto;
}
.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 24px;
}
.center {
  display: grid;
  gap: 16px;
  justify-items: start;
}
.user {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  color: var(--muted);
}
.user img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}
h1 {
  margin: 0 0 20px;
  font-size: 28px;
}
p {
  margin: 0;
  color: var(--muted);
}
form {
  display: grid;
  gap: 16px;
}
label {
  display: grid;
  gap: 8px;
  color: var(--muted);
  font-size: 14px;
}
input,
textarea,
select {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--foreground);
  font: inherit;
  padding: 10px 12px;
}
textarea {
  resize: vertical;
}
.body {
  font-family: "Google Sans Code", ui-monospace, SFMono-Regular, Consolas, monospace;
}
button,
.primary {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: var(--accent);
  color: var(--accent-foreground);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  padding: 10px 14px;
  text-decoration: none;
}
.user button {
  padding: 6px 10px;
}
output {
  display: block;
  min-height: 24px;
  margin-top: 16px;
  overflow-wrap: anywhere;
}
.error {
  color: #dc2626;
}
.success {
  color: var(--accent);
}
`;

function validateArticleInput(input: {
  title: string;
  description: string;
  tags: string[];
  author: string;
  slug: string;
  body: string;
}): void {
  if (input.title.length > 120) {
    throw new HttpError(400, "标题不能超过 120 个字符。");
  }
  if (input.description.length > 220) {
    throw new HttpError(400, "描述不能超过 220 个字符。");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
    throw new HttpError(400, "Slug 只能包含小写字母、数字和连字符。");
  }
  if (!/^[\p{L}\p{N}_-]{1,80}$/u.test(input.author)) {
    throw new HttpError(400, "作者字段格式不合法。");
  }
  if (input.tags.length < 2 || input.tags.length > 5) {
    throw new HttpError(400, "标签数量必须是 2 到 5 个。");
  }
  if (ENCODER.encode(input.body).byteLength > MAX_BODY_SIZE) {
    throw new HttpError(400, "正文不能超过 256 KB。");
  }
  if (input.body.trimStart().startsWith("---")) {
    throw new HttpError(400, "正文不能包含 frontmatter。");
  }
  rejectDangerousImports(input.body);
}

function rejectDangerousImports(body: string): void {
  const importPattern = /^\s*import\s+.+?\s+from\s+["']([^"']+)["']/gm;
  let match: RegExpExecArray | null;
  while ((match = importPattern.exec(body))) {
    const specifier = match[1];
    if (
      specifier.startsWith("http://") ||
      specifier.startsWith("https://") ||
      specifier.startsWith("/") ||
      specifier.includes("..") ||
      specifier.startsWith("node:") ||
      specifier.startsWith("cloudflare:") ||
      ["fs", "path", "child_process"].includes(specifier)
    ) {
      throw new HttpError(400, `正文包含不允许的 import：${specifier}`);
    }
  }
}

async function parseAttachments(
  form: FormData,
  repoDir: string,
  publicDir: string
): Promise<Attachment[]> {
  const files = getAttachmentFiles(form);

  if (files.length > MAX_ATTACHMENTS) {
    throw new HttpError(400, `图片附件最多 ${MAX_ATTACHMENTS} 个。`);
  }

  const originalNames = new Set<string>();
  const safeNames = new Set<string>();
  let totalSize = 0;
  const attachments: Attachment[] = [];

  for (const [index, file] of files.entries()) {
    totalSize += file.size;
    if (file.size > MAX_ATTACHMENT_SIZE) {
      throw new HttpError(400, `${file.name} 超过 3 MB。`);
    }
    if (totalSize > MAX_TOTAL_ATTACHMENT_SIZE) {
      throw new HttpError(400, "图片附件总大小不能超过 12 MB。");
    }

    const originalName = baseName(file.name);
    if (originalNames.has(originalName)) {
      throw new HttpError(
        400,
        `${originalName} 重复上传，正文占位符无法区分。`
      );
    }
    originalNames.add(originalName);

    const safeName = makeUniqueSafeFileName(
      originalName,
      index,
      safeNames,
      file.type
    );
    const bytes = new Uint8Array(await file.arrayBuffer());
    validateImageBytes(originalName, extensionOf(safeName), bytes);
    attachments.push({
      originalName,
      safeName,
      mime: file.type,
      size: file.size,
      publicPath: `${publicDir}/${safeName}`,
      repoPath: `${repoDir}/${safeName}`,
      bytes,
    });
  }

  return attachments;
}

function getAttachmentFiles(form: FormData): File[] {
  const files: File[] = [];
  const entries = (
    form as unknown as { entries(): Iterable<[string, unknown]> }
  ).entries();
  for (const [name, value] of entries) {
    if (name !== "attachments" || !(value instanceof File)) continue;
    if (!value.name.trim() || value.size === 0) continue;
    files.push(value);
  }
  return files;
}

function validateImageBytes(
  originalName: string,
  extension: string,
  bytes: Uint8Array
): void {
  const valid =
    extension === "png"
      ? startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      : extension === "jpg" || extension === "jpeg"
        ? startsWithBytes(bytes, [0xff, 0xd8, 0xff])
        : extension === "gif"
          ? startsWithAscii(bytes, "GIF87a") || startsWithAscii(bytes, "GIF89a")
          : extension === "webp"
            ? startsWithAscii(bytes, "RIFF") && asciiAt(bytes, 8, "WEBP")
            : extension === "avif"
              ? asciiAt(bytes, 4, "ftyp") &&
                decodeAscii(bytes.slice(8, 48)).includes("avif")
              : extension === "svg"
                ? validateSvgBytes(bytes)
                : false;

  if (!valid) {
    throw new HttpError(400, `${originalName} 的文件内容不是有效图片。`);
  }
}

function validateSvgBytes(bytes: Uint8Array): boolean {
  const text = DECODER.decode(bytes.slice(0, Math.min(bytes.length, 65536)));
  const normalized = text.trim().toLowerCase();
  if (!normalized.startsWith("<svg") && !normalized.startsWith("<?xml")) {
    return false;
  }
  return !/(<script\b|<foreignobject\b|\son[a-z]+\s*=|javascript:|data:text\/html)/i.test(
    text
  );
}

function startsWithBytes(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((byte, index) => bytes[index] === byte);
}

function startsWithAscii(bytes: Uint8Array, prefix: string): boolean {
  return asciiAt(bytes, 0, prefix);
}

function asciiAt(bytes: Uint8Array, offset: number, value: string): boolean {
  return decodeAscii(bytes.slice(offset, offset + value.length)) === value;
}

function decodeAscii(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes);
}

function makeUniqueSafeFileName(
  originalName: string,
  index: number,
  seen: Set<string>,
  mime: string
): string {
  const extension = extensionOf(originalName);
  const allowedMimes = MIME_BY_EXTENSION[extension];
  if (!allowedMimes) {
    throw new HttpError(400, `${originalName} 的文件类型不支持。`);
  }
  if (!mime || !allowedMimes.includes(mime)) {
    throw new HttpError(400, `${originalName} 的 MIME 类型不匹配。`);
  }

  const rawBase = originalName.slice(0, -(extension.length + 1));
  const normalizedBase =
    rawBase
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-") || `image-${index + 1}`;

  let safeName = `${normalizedBase}.${extension}`;
  let suffix = 2;
  while (seen.has(safeName)) {
    safeName = `${normalizedBase}-${suffix}.${extension}`;
    suffix += 1;
  }
  seen.add(safeName);
  return safeName;
}

function resolveAttachmentReferences(
  body: string,
  attachments: Attachment[],
  coverAttachment: string
): { body: string; coverPath?: string } {
  const attachmentsByName = new Map<string, Attachment>();
  for (const attachment of attachments) {
    addAttachmentAlias(attachmentsByName, attachment.originalName, attachment);
    addAttachmentAlias(attachmentsByName, attachment.safeName, attachment);
  }

  const usedAttachments = new Set<Attachment>();
  const bodyWithAttachmentPaths = body.replace(
    /\{\{file:([^}]+)\}\}/g,
    (_match, rawName: string) => {
      const name = rawName.trim();
      if (name !== baseName(name)) {
        throw new HttpError(400, `附件占位符只能使用文件名：${name}`);
      }
      const attachment = attachmentsByName.get(name);
      if (!attachment) {
        throw new HttpError(400, `正文引用了未上传的附件：${name}`);
      }
      usedAttachments.add(attachment);
      return attachment.publicPath;
    }
  );

  let coverPath: string | undefined;
  if (coverAttachment) {
    if (coverAttachment !== baseName(coverAttachment)) {
      throw new HttpError(400, "封面图只能使用上传文件名。");
    }
    const cover = attachmentsByName.get(coverAttachment);
    if (!cover) {
      throw new HttpError(400, "选择的封面图不在上传附件中。");
    }
    usedAttachments.add(cover);
    coverPath = cover.publicPath;
  }

  for (const attachment of attachments) {
    if (!usedAttachments.has(attachment)) {
      throw new HttpError(
        400,
        `${attachment.originalName} 未被正文引用，也未被选为封面图。`
      );
    }
  }

  return { body: bodyWithAttachmentPaths, coverPath };
}

function addAttachmentAlias(
  attachmentsByName: Map<string, Attachment>,
  name: string,
  attachment: Attachment
): void {
  const existing = attachmentsByName.get(name);
  if (existing && existing !== attachment) {
    throw new HttpError(400, `附件文件名冲突：${name}`);
  }
  attachmentsByName.set(name, attachment);
}

function buildMdx(input: {
  author: string;
  pubDatetime: string;
  title: string;
  slug: string;
  tags: string[];
  description: string;
  ogImage?: string;
  body: string;
}): string {
  const lines = [
    "---",
    `author: ${yamlString(input.author)}`,
    `pubDatetime: ${input.pubDatetime}`,
    `title: ${yamlString(input.title)}`,
    `slug: ${input.slug}`,
    "featured: false",
    "draft: true",
    "tags:",
    ...input.tags.map(tag => `  - ${yamlString(tag)}`),
    `description: ${yamlString(input.description)}`,
  ];
  if (input.ogImage) {
    lines.push(`ogImage: ${yamlString(input.ogImage)}`);
  }
  lines.push("---", "", input.body.trim(), "");
  return lines.join("\n");
}

async function createPullRequestWithFiles(
  env: Env,
  input: {
    branch: string;
    title: string;
    commitMessage: string;
    body: string;
    files: RepoFile[];
  }
): Promise<{ html_url: string }> {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const baseBranch = env.BASE_BRANCH;
  if (!owner || !repo || !baseBranch) {
    throw new HttpError(500, "GitHub 仓库配置不完整。");
  }

  const baseRef = await githubJson<{ object: { sha: string } }>(
    env,
    `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(baseBranch)}`
  );
  const baseCommit = await githubJson<{ tree: { sha: string } }>(
    env,
    `/repos/${owner}/${repo}/git/commits/${baseRef.object.sha}`
  );

  await assertPathsDoNotExist(env, owner, repo, baseBranch, input.files);

  const treeItems = [];
  for (const file of input.files) {
    const blob = await githubJson<{ sha: string }>(
      env,
      `/repos/${owner}/${repo}/git/blobs`,
      {
        method: "POST",
        body: JSON.stringify({
          content: bytesToBase64(file.content),
          encoding: "base64",
        }),
      }
    );
    treeItems.push({
      path: file.path,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }

  const tree = await githubJson<{ sha: string }>(
    env,
    `/repos/${owner}/${repo}/git/trees`,
    {
      method: "POST",
      body: JSON.stringify({
        base_tree: baseCommit.tree.sha,
        tree: treeItems,
      }),
    }
  );
  const commit = await githubJson<{ sha: string }>(
    env,
    `/repos/${owner}/${repo}/git/commits`,
    {
      method: "POST",
      body: JSON.stringify({
        message: input.commitMessage,
        tree: tree.sha,
        parents: [baseRef.object.sha],
      }),
    }
  );
  await githubJson(env, `/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({
      ref: `refs/heads/${input.branch}`,
      sha: commit.sha,
    }),
  });

  return githubJson<{ html_url: string }>(env, `/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      head: input.branch,
      base: baseBranch,
      body: input.body,
      maintainer_can_modify: true,
    }),
  });
}

async function assertPathsDoNotExist(
  env: Env,
  owner: string,
  repo: string,
  baseBranch: string,
  files: RepoFile[]
): Promise<void> {
  for (const file of files) {
    const response = await githubFetch(
      env,
      `/repos/${owner}/${repo}/contents/${encodeGitHubPath(
        file.path
      )}?ref=${encodeURIComponent(baseBranch)}`
    );
    if (response.status === 404) continue;
    if (response.ok) {
      throw new HttpError(409, `目标路径已存在：${file.path}`);
    }
    await throwGitHubError(response);
  }
}

function buildPullRequestBody(input: {
  submitter: string;
  articlePath: string;
  attachmentPaths: string[];
  coverPath?: string;
  tags: string[];
  description: string;
}): string {
  const attachmentLines = input.attachmentPaths.length
    ? input.attachmentPaths.map(path => `- ${path}`).join("\n")
    : "- 无";
  return `## Description

通过 Nuist DEV MDX 投稿 Worker 自动创建。

投稿人：@${input.submitter}

文章路径：\`${input.articlePath}\`

标签：${input.tags.join(", ")}

描述：${input.description}

封面图：${input.coverPath ?? "未设置"}

附件：
${attachmentLines}

## Types of changes

- [ ] Bug Fix (non-breaking change which fixes an issue)
- [ ] New Feature (non-breaking change which adds functionality)
- [x] Documentation Update (if none of the other choices apply)
- [ ] Others (any other types not listed above)

## Checklist

- [ ] I have read the [Contributing Guide](https://github.com/satnaing/astro-paper/blob/main/.github/CONTRIBUTING.md)
- [ ] I have added the necessary documentation (if appropriate)
- [ ] Breaking Change (fix or feature that would cause existing functionality to not work as expected)

## Further comments

新文章默认 \`draft: true\`，请审核后再发布。

## Related Issue

Closes: #`;
}

async function githubJson<T>(
  env: Env,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await githubFetch(env, path, init);
  if (!response.ok) {
    await throwGitHubError(response);
  }
  return response.json<T>();
}

async function githubFetch(
  env: Env,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${env.GITHUB_BOT_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "Nuist-Dev-MDX-PR-Worker",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {}),
    },
  });
}

async function throwGitHubError(response: Response): Promise<never> {
  let message = `GitHub API 请求失败：HTTP ${response.status}`;
  try {
    const body = await response.json<{ message?: string }>();
    if (body.message) message = `GitHub API 请求失败：${body.message}`;
  } catch {
    // Ignore non-JSON GitHub error responses.
  }
  throw new HttpError(response.status, message);
}

async function readSession(
  request: Request,
  env: Env
): Promise<Session | null> {
  if (!env.SESSION_SECRET) return null;
  const token = parseCookies(request.headers.get("Cookie") ?? "").get(
    SESSION_COOKIE
  );
  if (!token) return null;
  const session = await verifySignedToken<Session>(token, env.SESSION_SECRET);
  if (!session || session.exp < nowSeconds()) return null;
  return session;
}

async function requireSession(
  request: Request,
  env: Env
): Promise<Session> {
  const session = await readSession(request, env);
  if (!session) {
    throw new HttpError(401, "请先使用 GitHub 登录。");
  }
  return session;
}

async function createSignedToken(
  payload: unknown,
  secret: string
): Promise<string> {
  const encodedPayload = base64UrlEncode(ENCODER.encode(JSON.stringify(payload)));
  const signature = await sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

async function verifySignedToken<T>(
  token: string,
  secret: string
): Promise<T | null> {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = await sign(payload, secret);
  if (!safeEqual(signature, expected)) return null;
  try {
    return JSON.parse(DECODER.decode(base64UrlDecode(payload))) as T;
  } catch {
    return null;
  }
}

async function sign(input: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    ENCODER.encode(input)
  );
  return base64UrlEncode(new Uint8Array(signature));
}

function parseCookies(header: string): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (!name || !value.length) continue;
    cookies.set(name, decodeURIComponent(value.join("=")));
  }
  return cookies;
}

function cookie(name: string, value: string, maxAge: number): string {
  return `${name}=${encodeURIComponent(
    value
  )}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function clearCookie(name: string): string {
  return `${name}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ Location: location });
  for (const value of cookies) {
    headers.append("Set-Cookie", value);
  }
  return new Response(null, { status: 302, headers });
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function wantsJson(request: Request): boolean {
  return (
    request.headers.get("Accept")?.includes("application/json") ||
    new URL(request.url).pathname.startsWith("/api/")
  );
}

function requiredText(form: FormData, name: string, label: string): string {
  const value = text(form, name).trim();
  if (!value) throw new HttpError(400, `${label}不能为空。`);
  return value;
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

function parseTags(value: string): string[] {
  const tags = value
    .split(/[\n,，]/)
    .map(tag => tag.trim())
    .filter(Boolean);
  return Array.from(new Set(tags));
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function fallbackSlug(title: string, dates: DateParts): string {
  return normalizeSlug(title) || `post-${dates.yyyymmdd}-${randomHex(3)}`;
}

function getShanghaiDateParts(timeZone: string): DateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const yyyy = parts.find(part => part.type === "year")?.value ?? "1970";
  const mm = parts.find(part => part.type === "month")?.value ?? "01";
  const dd = parts.find(part => part.type === "day")?.value ?? "01";
  return {
    yyyy,
    yy: yyyy.slice(-2),
    mm,
    dd,
    yyyymmdd: `${yyyy}${mm}${dd}`,
  };
}

function baseName(path: string): string {
  return path.split(/[\\/]/).pop()?.trim() ?? "";
}

function extensionOf(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match?.[1].toLowerCase() ?? "";
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, "0")).join("");
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function requireEnv(env: Env, keys: Array<keyof Env>): void {
  const missing = keys.filter(key => !env[key]);
  if (missing.length) {
    throw new HttpError(500, `缺少 Worker 配置：${missing.join(", ")}`);
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64UrlEncode(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function encodeGitHubPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}
