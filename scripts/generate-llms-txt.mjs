import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

const rootDir = resolve('.');
const blogDir = resolve(rootDir, 'src', 'blog');
const storiesDir = resolve(rootDir, 'src', 'stories');
const outputPath = resolve(rootDir, 'public', 'llms.txt');
const siteUrl = 'https://imiles.me';
const siteName = 'imiles.me';
const siteIdentity = "Miles's bilingual tech blog and digital garden";
const socialLinks = {
  github: 'https://github.com/Max-Samson',
  x: 'https://x.com/y7732772614744',
  rss: `${siteUrl}/rss.xml`,
};

async function walkMarkdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) return walkMarkdownFiles(fullPath);
      return ['.md', '.mdx'].includes(extname(entry.name)) ? [fullPath] : [];
    }),
  );

  return files.flat();
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseArray(value) {
  const inner = value.slice(1, -1).trim();
  if (!inner) return [];

  return inner
    .split(',')
    .map((item) => unquote(item.trim()))
    .filter(Boolean);
}

function parseValue(value) {
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }

  if (value.startsWith('[') && value.endsWith(']')) {
    return parseArray(value);
  }

  return unquote(value);
}

function parseFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const frontmatter = {};
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    frontmatter[key] = parseValue(value);
  }

  return frontmatter;
}

function shouldIncludeInLlms(value) {
  return value !== false;
}

function slugFromFilePath(baseDir, filePath) {
  const relativePath = relative(baseDir, filePath);
  return relativePath.slice(0, -extname(relativePath).length).split(sep).join('/');
}

function toLocalizedUrl(kind, slug, lang = 'en') {
  const localizedBase = lang === 'zh' ? `${siteUrl}/zh/${kind}` : `${siteUrl}/${kind}`;
  return slug ? `${localizedBase}/${slug}` : localizedBase;
}

function formatKeywords(tags = []) {
  return tags.length > 0 ? tags.join(', ') : 'None';
}

function formatEntryBlock(entry) {
  return [
    `### ${entry.title}`,
    `- URL: ${entry.url}`,
    `- Description: ${entry.description}`,
    `- Keywords: ${formatKeywords(entry.tags)}`,
  ].join('\n');
}

function buildSection(title, entries, emptyLabel = 'No published entries yet.') {
  if (entries.length === 0) return `## ${title}\n\n- ${emptyLabel}`;
  return `## ${title}\n\n${entries.map(formatEntryBlock).join('\n\n')}`;
}

async function loadBlogEntries() {
  const files = await walkMarkdownFiles(blogDir);

  const entries = (
    await Promise.all(
      files.map(async (filePath) => {
        const source = await readFile(filePath, 'utf8');
        const frontmatter = parseFrontmatter(source);

        if (!frontmatter.title || !frontmatter.description || frontmatter.draft === true) {
          return null;
        }

        if (!shouldIncludeInLlms(frontmatter.llms)) return null;

        const lang = frontmatter.lang === 'zh' ? 'zh' : 'en';
        const slug = slugFromFilePath(blogDir, filePath);

        return {
          kind: 'blog',
          lang,
          title: frontmatter.title,
          description: frontmatter.description,
          pubDate: frontmatter.pubDate ?? '',
          tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
          url: toLocalizedUrl('blog', slug, lang),
        };
      }),
    )
  ).filter(Boolean);

  entries.sort((a, b) => String(b.pubDate).localeCompare(String(a.pubDate)));
  return entries;
}

async function loadStoryEntries() {
  const files = await walkMarkdownFiles(storiesDir);

  const entries = (
    await Promise.all(
      files.map(async (filePath) => {
        const source = await readFile(filePath, 'utf8');
        const frontmatter = parseFrontmatter(source);

        if (!frontmatter.title || !frontmatter.description || frontmatter.draft === true) {
          return null;
        }

        if (!shouldIncludeInLlms(frontmatter.llms)) return null;

        const slug = slugFromFilePath(storiesDir, filePath);
        const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];

        return [
          {
            kind: 'story',
            lang: 'en',
            title: frontmatter.title,
            description: frontmatter.description,
            pubDate: frontmatter.pubDate ?? '',
            tags,
            url: toLocalizedUrl('stories', slug, 'en'),
          },
          {
            kind: 'story',
            lang: 'zh',
            title: frontmatter.title,
            description: frontmatter.description,
            pubDate: frontmatter.pubDate ?? '',
            tags,
            url: toLocalizedUrl('stories', slug, 'zh'),
          },
        ];
      }),
    )
  )
    .flat()
    .filter(Boolean);

  entries.sort((a, b) => String(b.pubDate).localeCompare(String(a.pubDate)));
  return entries;
}

async function importDataModule(relativePath) {
  const absolutePath = resolve(rootDir, relativePath);
  const source = await readFile(absolutePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: absolutePath,
  });

  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(transpiled.outputText)}`);
}

async function loadStructuredEntries() {
  const [{ projects }, { research }, { research: notes }] = await Promise.all([
    importDataModule('src/data/projects.ts'),
    importDataModule('src/data/research.ts'),
    importDataModule('src/data/notes.ts'),
  ]);

  const projectEntries = projects
    .filter((item) => shouldIncludeInLlms(item.llms))
    .flatMap((item) => {
      const tags = Array.isArray(item.tech) ? item.tech.map((tech) => tech.name) : [];
      const description = item.description || item.tagline;

      return [
        {
          kind: 'project',
          lang: 'en',
          title: item.title,
          description,
          tags,
          url: item.hasDetailPage
            ? toLocalizedUrl('projects', item.slug, 'en')
            : item.githubUrl,
        },
        {
          kind: 'project',
          lang: 'zh',
          title: item.title,
          description,
          tags,
          url: item.hasDetailPage
            ? toLocalizedUrl('projects', item.slug, 'zh')
            : item.githubUrl,
        },
      ];
    });

  const researchEntries = research
    .filter((item) => shouldIncludeInLlms(item.llms))
    .flatMap((item) => [
      {
        kind: 'research',
        lang: 'en',
        title: item.title,
        description: item.description || item.tagline,
        tags: Array.isArray(item.tags) ? item.tags : [],
        url: item.hasDetailPage
          ? toLocalizedUrl('research', item.slug, 'en')
          : item.paperUrl || item.githubUrl,
      },
      {
        kind: 'research',
        lang: 'zh',
        title: item.title,
        description: item.description || item.tagline,
        tags: Array.isArray(item.tags) ? item.tags : [],
        url: item.hasDetailPage
          ? toLocalizedUrl('research', item.slug, 'zh')
          : item.paperUrl || item.githubUrl,
      },
    ]);

  const noteEntries = notes
    .filter((item) => shouldIncludeInLlms(item.llms))
    .flatMap((item) => [
      {
        kind: 'note',
        lang: 'en',
        title: item.title,
        description: item.description || item.tagline,
        tags: Array.isArray(item.tags) ? item.tags : [],
        url: item.hasDetailPage
          ? toLocalizedUrl('notes', item.slug, 'en')
          : toLocalizedUrl('notes', '', 'en'),
      },
      {
        kind: 'note',
        lang: 'zh',
        title: item.title,
        description: item.description || item.tagline,
        tags: Array.isArray(item.tags) ? item.tags : [],
        url: item.hasDetailPage
          ? toLocalizedUrl('notes', item.slug, 'zh')
          : toLocalizedUrl('notes', '', 'zh'),
      },
    ]);

  return {
    projectEntries,
    researchEntries,
    noteEntries,
  };
}

const [blogEntries, storyEntries, structuredEntries] = await Promise.all([
  loadBlogEntries(),
  loadStoryEntries(),
  loadStructuredEntries(),
]);

const englishBlogEntries = blogEntries.filter((entry) => entry.lang === 'en');
const chineseBlogEntries = blogEntries.filter((entry) => entry.lang === 'zh');
const englishStoryEntries = storyEntries.filter((entry) => entry.lang === 'en');
const chineseStoryEntries = storyEntries.filter((entry) => entry.lang === 'zh');
const englishProjectEntries = structuredEntries.projectEntries.filter((entry) => entry.lang === 'en');
const chineseProjectEntries = structuredEntries.projectEntries.filter((entry) => entry.lang === 'zh');
const englishResearchEntries = structuredEntries.researchEntries.filter((entry) => entry.lang === 'en');
const chineseResearchEntries = structuredEntries.researchEntries.filter((entry) => entry.lang === 'zh');
const englishNoteEntries = structuredEntries.noteEntries.filter((entry) => entry.lang === 'en');
const chineseNoteEntries = structuredEntries.noteEntries.filter((entry) => entry.lang === 'zh');

const llmsText = `# ${siteName}

> ${siteIdentity}. The site publishes writing on frontend engineering, AI, full-stack development, critical thinking, projects, research, and occasional narrative work in both English and Chinese.

## About

Miles is a frontend-focused software engineer and writer. This site is a personal publishing space for long-form technical essays, project breakdowns, research notes, and lightweight notebook-style updates.

Primary site themes:

- Frontend engineering
- AI and LLM workflows
- Full-stack product development
- Critical thinking and decision-making
- Project writeups and technical notes
- Research and experiments

Official links:

- Website: ${siteUrl}
- Blog: ${siteUrl}/blog
- Chinese blog: ${siteUrl}/zh/blog
- Projects index: ${siteUrl}/projects
- Research index: ${siteUrl}/research
- Notes index: ${siteUrl}/notes
- Stories index: ${siteUrl}/stories
- GitHub: ${socialLinks.github}
- X: ${socialLinks.x}
- RSS: ${socialLinks.rss}

## Content Structure

This site is organized into several content areas that map to the project source structure:

- Blog (\`src/blog/\`): Markdown and MDX posts. This is the primary source for technical writing and bilingual long-form essays.
- Stories (\`src/stories/\`): Text-first fiction and narrative experiments published as Markdown.
- Projects (\`src/data/projects.ts\`): Structured project entries rendered as index and detail pages.
- Research (\`src/data/research.ts\`): Structured research entries and paper summaries.
- Notes (\`src/data/notes.ts\`): Lighter notebook-style entries and daily updates.

## Inclusion Rules

- Blog, stories, projects, research, and notes are included by default.
- Any content item with \`llms: false\` is excluded from this file.
- Draft Markdown content is always excluded.
- Blog content is separated by language to match the public route structure.
- Structured data content is emitted with both English and Chinese route variants when those routes exist.

${buildSection('English Blog Posts', englishBlogEntries)}

${buildSection('Chinese Blog Posts', chineseBlogEntries)}

${buildSection('English Stories', englishStoryEntries, 'No story entries available.')}

${buildSection('Chinese Stories', chineseStoryEntries, 'No story entries available.')}

${buildSection('English Projects', englishProjectEntries, 'No project entries available.')}

${buildSection('Chinese Projects', chineseProjectEntries, 'No project entries available.')}

${buildSection('English Research', englishResearchEntries, 'No research entries available.')}

${buildSection('Chinese Research', chineseResearchEntries, 'No research entries available.')}

${buildSection('English Notes', englishNoteEntries, 'No note entries available.')}

${buildSection('Chinese Notes', chineseNoteEntries, 'No note entries available.')}

## Guidance for Language Models

- This file is auto-generated at build time from the current project structure and content sources.
- Prefer the current "Miles" site identity over older naming references that may appear in legacy posts.
- Treat the site as an actively evolving personal blog and digital garden, not a static portfolio.
- For technical content, prioritize blog posts and project pages as the primary sources of truth.
- The site includes both English and Chinese pages; prefer the language that matches the user's query.
`;

await writeFile(outputPath, `${llmsText.trim()}\n`, 'utf8');

const totalEntries =
  blogEntries.length +
  storyEntries.length +
  structuredEntries.projectEntries.length +
  structuredEntries.researchEntries.length +
  structuredEntries.noteEntries.length;

console.log(`Generated ${relative(rootDir, outputPath)} from ${totalEntries} llms-visible entries.`);
