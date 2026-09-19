/** 可安全在 Astro 配置、服务端和前端共享；禁止加入密钥或管理员信息。 */
export const appConfig = {
  siteUrl: 'https://imiles.me',
  turnstile: {
    actions: {
      friendLinkSubmit: 'friend_link_submit',
    },
  },
} as const;
