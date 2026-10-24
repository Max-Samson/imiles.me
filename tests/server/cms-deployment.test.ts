import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyGitHubPublicationDeployment } from '../../src/server/admin/cms/deployment-verifier';

const commitSha = 'a'.repeat(40);
const deployedSha = 'b'.repeat(40);
const blobSha = 'c'.repeat(40);
const env = {
  CMS_GITHUB_REPO: 'owner/repo',
  CMS_GITHUB_BRANCH: 'main',
  CMS_GITHUB_TOKEN: 'test-token',
};
const target = {
  targetPath: 'content/blog/hello.mdx',
  resultBlobSha: blobSha,
  resultCommitSha: commitSha,
};
const run = {
  id: 42,
  head_branch: 'main',
  head_sha: deployedSha,
  path: '.github/workflows/deploy.yml@refs/heads/main',
  event: 'push',
  status: 'completed',
  conclusion: 'success',
  updated_at: '2026-10-24T00:00:00Z',
};

test('仅成功的 Deploy 工作流、包含发布提交且文件 blob 匹配时确认部署', async () => {
  const called: string[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    called.push(url);
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-token');
    assert.equal(init?.redirect, 'error');
    if (url.includes('/actions/workflows/deploy.yml/runs'))
      return Response.json({ workflow_runs: [run] });
    if (url.includes('/compare/')) return Response.json({ status: 'ahead' });
    if (url.includes('/contents/')) return Response.json({ type: 'file', sha: blobSha });
    throw new Error(`unexpected URL: ${url}`);
  }) as typeof fetch;
  const evidence = await verifyGitHubPublicationDeployment(env, target, fetcher);
  assert.deepEqual(evidence, {
    status: 'verified',
    ref: '42',
    deployedAt: Date.parse(run.updated_at),
  });
  assert.equal(called.length, 3);
  assert.ok(called[1].includes(`${commitSha}...${deployedSha}`));
  assert.ok(called[2].includes(`?ref=${deployedSha}`));
});

test('工作流成功但不包含发布提交或文件版本不符时保持未核实', async () => {
  for (const mode of ['unrelated', 'changed', 'deleted'] as const) {
    const fetcher = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/actions/')) return Response.json({ workflow_runs: [run] });
      if (url.includes('/compare/'))
        return Response.json({ status: mode === 'unrelated' ? 'diverged' : 'ahead' });
      if (url.includes('/contents/'))
        return mode === 'deleted'
          ? new Response(null, { status: 404 })
          : Response.json({ type: 'file', sha: 'd'.repeat(40) });
      throw new Error('unexpected request');
    }) as typeof fetch;
    assert.equal(
      (await verifyGitHubPublicationDeployment(env, target, fetcher)).status,
      'unverified',
    );
  }
});

test('测试分支不冒充生产部署，原提交排队时仅报告待部署', async () => {
  const noNetwork = (async () => {
    throw new Error('must not fetch');
  }) as typeof fetch;
  assert.equal(
    (
      await verifyGitHubPublicationDeployment(
        { ...env, CMS_GITHUB_BRANCH: 'cms/test' },
        target,
        noNetwork,
      )
    ).status,
    'unverified',
  );
  const fetcher = (async () =>
    Response.json({
      workflow_runs: [{ ...run, head_sha: commitSha, status: 'queued', conclusion: null }],
    })) as typeof fetch;
  assert.deepEqual(await verifyGitHubPublicationDeployment(env, target, fetcher), {
    status: 'pending',
    ref: '42',
    deployedAt: null,
  });
});
