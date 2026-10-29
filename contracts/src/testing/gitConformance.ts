import { GitService } from '../services/git';

export async function runGitConformanceTests(
  createService: () => Promise<GitService> | GitService
) {
  const git = await createService();

  // 1. Current Branch
  const currentBranch = await git.currentBranch();
  if (!currentBranch) {
    throw new Error('currentBranch returned empty string');
  }

  // 2. Status
  const status = await git.status();
  if (!Array.isArray(status)) {
    throw new Error('status did not return an array');
  }

  // 3. Branches
  const branches = await git.branches();
  if (!Array.isArray(branches) || branches.length === 0) {
    throw new Error('branches returned empty array');
  }

  // 4. Log
  const log = await git.log({ limit: 5 });
  if (!Array.isArray(log) || log.length === 0) {
    throw new Error('log returned empty array');
  }

  // 5. Diff Summary
  const diffSummary = await git.getDiffSummary();
  if (typeof diffSummary.files !== 'number') {
    throw new Error('getDiffSummary did not return valid summary');
  }

  return true;
}
