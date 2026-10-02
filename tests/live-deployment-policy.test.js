import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const CANONICAL_BRANCH = 'feat/multiplayer-phase-2-shared-world';

test('exactly one workflow can deploy the live game, from the canonical branch only', async () => {
  const workflowDir = path.join(process.cwd(), '.github', 'workflows');
  const files = (await readdir(workflowDir)).filter((name) => /\.ya?ml$/i.test(name));
  const deployers = [];

  for (const name of files) {
    const content = await readFile(path.join(workflowDir, name), 'utf8');
    if (content.includes('actions/deploy-pages@')) deployers.push({ name, content });
  }

  assert.equal(deployers.length, 1, 'there must be exactly one GitHub Pages deploy workflow');
  const [{ content }] = deployers;
  assert.match(content, /name:\s*Live Game Deploy/);
  assert.equal(content.includes(CANONICAL_BRANCH), true);
  assert.doesNotMatch(content, /workflow_dispatch/);
  assert.match(
    content,
    /if:\s*github\.ref == 'refs\/heads\/feat\/multiplayer-phase-2-shared-world'/,
  );
});
