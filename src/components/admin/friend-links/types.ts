/** 友链从申请到公开展示的生命周期状态。 */
export type FriendLinkStatus = 'pending' | 'active' | 'rejected' | 'hidden';

/** 管理员可以对友链执行的状态变更操作。 */
export type ReviewAction = 'approve' | 'reject' | 'hide' | 'restore';

/** 友链管理列表中的单条摘要数据。 */
export interface AdminFriendLink {
  id: string;
  name: string | null;
  url: string;
  description: string;
  email: string | null;
  status: FriendLinkStatus;
  version: number;
  reviewedBy: string | null;
  reviewedAt: number | null;
  publishedAt: number | null;
  createdAt: number;
  updatedAt: number;
  hasScreenshot: boolean;
}

/** 友链详情数据，包含原始提交地址、最后更新人和后台截图地址。 */
export interface AdminFriendLinkDetail extends Omit<AdminFriendLink, 'hasScreenshot'> {
  submittedUrl: string;
  updatedBy: string | null;
  screenshotUrl: string | null;
}

/** 友链管理列表的分页结果。 */
export interface AdminFriendLinkPage {
  items: AdminFriendLink[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}
