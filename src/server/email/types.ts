/**
 * 邮件服务核心类型契约与入参定义。
 */

export interface SendEmailPayload {
  /** 发件人信息，例如 "imiles <noreply@imiles.me>"；若未传则使用默认配置 */
  from?: string;
  /** 收件人地址或地址列表 */
  to: string | string[];
  /** 回复地址（可选） */
  replyTo?: string;
  /** 邮件主题 */
  subject: string;
  /** HTML 邮件内容 */
  html: string;
  /** 纯文本备用内容 */
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  /** Resend 返回的邮件消息 ID */
  id?: string;
  /** 若发送失败，记录脱敏或标准错误信息 */
  error?: string;
}

export interface EmailClient {
  send(payload: SendEmailPayload): Promise<SendEmailResult>;
}

/** 友链审批通过通知邮件模板参数 */
export interface FriendLinkApprovedEmailParams {
  /** 申请人称谓 / 站点名称 */
  applicantName?: string | null;
  /** 申请人站点 URL */
  applicantUrl: string;
  /** 本站基础 URL（如 https://imiles.me） */
  siteUrl: string;
  /** 审批管理员可附加的自定义留言（可选） */
  customMessage?: string;
}

/** 新友链提交时通知管理员的邮件模板参数 */
export interface AdminNewApplicationEmailParams {
  applicantName?: string | null;
  applicantUrl: string;
  applicantEmail: string;
  description: string;
  detailUrl: string;
}
