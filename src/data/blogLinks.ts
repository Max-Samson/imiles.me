export const blogNoteLinks = {
  'astro-to-nuxt-ecosystem-fullstack':
    'https://www.xiaohongshu.com/user/profile/5d34370b0000000011014501/6a1b036d0000000038021268?xsec_token=ABKRWv5g87kbDwqXL76i4WDv0sOQfWvNcDhUWVR0gtVLQ=&xsec_source=pc_user',
} as const satisfies Partial<Record<string, string>>;

export function getBlogNoteLink(slug: string) {
  const url = blogNoteLinks[slug as keyof typeof blogNoteLinks];
  return url && url.trim().length > 0 ? url : undefined;
}
