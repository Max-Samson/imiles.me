import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: ['**/*.md', '**/*.mdx'], base: './content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    lang: z.enum(['en', 'zh']).default('en'),
    shareText: z.string().optional(),
    llms: z.boolean().default(false),
  }),
});

const stories = defineCollection({
  loader: glob({ pattern: ['**/*.md', '**/*.mdx'], base: './content/stories' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    lang: z.enum(['en', 'zh']).default('en'),
    llms: z.boolean().optional(),
  }),
});

/**
 * Experience collection — MDX files in content/experience/
 *
 * Frontmatter schema:
 *   title      — role / award / degree title
 *   titleZh    — Chinese title
 *   org        — organisation / school name
 *   orgZh      — Chinese org name
 *   orgUrl     — (optional) link
 *   period     — display date range e.g. "2024 — Present"
 *   periodZh   — Chinese date range
 *   year       — anchor year shown in sticky left column
 *   type       — 'work' | 'education' | 'award' | 'project'
 *   tags       — skill / keyword tags
 *   lang       — 'en' | 'zh'  (one file per language)
 *   draft      — hide from production when true
 *   startDate  — optional explicit start date (e.g. "2025-09")
 *   endDate    — optional explicit end date (e.g. "2026-06" or "present")
 *   order      — optional manual override
 */
const experience = defineCollection({
  loader: glob({ pattern: ['**/*.mdx'], base: './content/experience' }),
  schema: z.object({
    title: z.string(),
    titleZh: z.string(),
    org: z.string(),
    orgZh: z.string(),
    orgUrl: z.string().optional(),
    period: z.string(),
    periodZh: z.string(),
    year: z.string(),
    type: z.enum(['work', 'education', 'award', 'project']),
    tags: z.array(z.string()).default([]),
    tagsZh: z.array(z.string()).optional(),
    draft: z.boolean().default(false),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    order: z.number().optional(),
  }),
});

export const collections = { blog, stories, experience };
