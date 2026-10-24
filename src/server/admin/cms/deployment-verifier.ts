import type { CloudflareEnv } from '../../../env.d';
import { AppError } from '../../errors';

export interface PublicationDeploymentTarget {
  targetPath: string;
  resultBlobSha: string;
  resultCommitSha: string;
}

export interface DeploymentEvidence {
  status: 'unverified' | 'pending' | 'running' | 'verified' | 'failed' | 'cancelled';
  ref: string | null;
  deployedAt: number | null;
}

type WorkflowRun = {
  id?: unknown;
  head_branch?: unknown;
  head_sha?: unknown;
  path?: unknown;
  event?: unknown;
  status?: unknown;
  conclusion?: unknown;
  updated_at?: unknown;
};

const unverified = (): DeploymentEvidence => ({
  status: 'unverified',
  ref: null,
  deployedAt: null,
});
const shaPattern = /^[a-f0-9]{40}$/i;

/** 只接受固定 Deploy 工作流的证据；Git 提交成功本身不能证明公开页面已更新。 */
export async function verifyGitHubPublicationDeployment(
  env: CloudflareEnv,
  target: PublicationDeploymentTarget,
  fetcher: typeof fetch = fetch,
): Promise<DeploymentEvidence> {
  const repository = env.CMS_GITHUB_REPO;
  const branch = env.CMS_GITHUB_BRANCH;
  const token = env.CMS_GITHUB_TOKEN;
  if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository) || !branch || !token) {
    throw new AppError('CMS GitHub 部署核验配置尚未完成', 503, 'CMS_NOT_CONFIGURED');
  }
  if (
    !shaPattern.test(target.resultBlobSha) ||
    !shaPattern.test(target.resultCommitSha) ||
    !/^content\/(blog|stories)\/(?:[^/]+\/)*[^/]+\.mdx?$/.test(target.targetPath)
  ) {
    throw new AppError('发布操作缺少可信的 Git 版本', 409, 'CMS_DEPLOYMENT_UNVERIFIED');
  }
  // deploy.yml 只在主分支的 push / workflow_dispatch 上部署，测试分支始终保持未核实。
  if (branch !== 'main' && branch !== 'master') return unverified();

  const base = `https://api.github.com/repos/${repository}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'imiles-cms',
  };
  async function getJson(url: string, allowMissing = false): Promise<unknown> {
    let response: Response;
    try {
      response = await fetcher(url, {
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new AppError('GitHub 部署核验暂时不可用', 502, 'CMS_DEPLOYMENT_CHECK_ERROR');
    }
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) throw new AppError('GitHub 部署核验失败', 502, 'CMS_DEPLOYMENT_CHECK_ERROR');
    try {
      return await response.json();
    } catch {
      throw new AppError('GitHub 部署核验响应无效', 502, 'CMS_DEPLOYMENT_CHECK_ERROR');
    }
  }

  const query = new URLSearchParams({ branch, per_page: '100' });
  const listed = (await getJson(`${base}/actions/workflows/deploy.yml/runs?${query}`)) as {
    workflow_runs?: unknown;
  };
  if (!Array.isArray(listed?.workflow_runs))
    throw new AppError('GitHub 工作流列表无效', 502, 'CMS_DEPLOYMENT_CHECK_ERROR');
  const runs = (listed.workflow_runs as WorkflowRun[])
    // 忽略同仓库的其他工作流、分支与手工伪造的非 Deploy 记录。
    .filter(
      (run) =>
        run &&
        run.head_branch === branch &&
        typeof run.head_sha === 'string' &&
        shaPattern.test(run.head_sha) &&
        typeof run.path === 'string' &&
        run.path.startsWith('.github/workflows/deploy.yml@') &&
        (run.event === 'push' || run.event === 'workflow_dispatch') &&
        typeof run.id === 'number' &&
        Number.isSafeInteger(run.id) &&
        typeof run.updated_at === 'string' &&
        Number.isFinite(Date.parse(run.updated_at)),
    )
    .sort((a, b) => Date.parse(String(b.updated_at)) - Date.parse(String(a.updated_at)));
  const successful = runs.find((run) => run.status === 'completed' && run.conclusion === 'success');
  if (successful) {
    // 较新的成功部署可以包含本次提交；仍须核对该次部署提交中的目标文件 blob 未改变。
    const head = String(successful.head_sha);
    const comparison = (await getJson(`${base}/compare/${target.resultCommitSha}...${head}`)) as {
      status?: unknown;
    };
    if (comparison.status === 'ahead' || comparison.status === 'identical') {
      const path = target.targetPath.split('/').map(encodeURIComponent).join('/');
      const file = (await getJson(`${base}/contents/${path}?ref=${head}`, true)) as {
        sha?: unknown;
        type?: unknown;
      } | null;
      if (file?.type === 'file' && file.sha === target.resultBlobSha) {
        return {
          status: 'verified',
          ref: String(successful.id),
          deployedAt: Date.parse(String(successful.updated_at)),
        };
      }
    }
  }

  const ownRun = runs.find((run) => run.head_sha === target.resultCommitSha);
  // 没有完整版本证据时，仅报告本次提交自己的工作流状态，不推断内容已经上线。
  if (!ownRun) return unverified();
  const ref = String(ownRun.id);
  if (ownRun.status === 'in_progress') return { status: 'running', ref, deployedAt: null };
  if (['queued', 'requested', 'waiting', 'pending'].includes(String(ownRun.status)))
    return { status: 'pending', ref, deployedAt: null };
  if (ownRun.conclusion === 'failure' || ownRun.conclusion === 'timed_out')
    return { status: 'failed', ref, deployedAt: null };
  if (ownRun.conclusion === 'cancelled') return { status: 'cancelled', ref, deployedAt: null };
  return unverified();
}
