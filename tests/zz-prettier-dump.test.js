import fs from 'node:fs/promises';
import test from 'node:test';
import prettier from 'prettier';

test('dump repo-configured invitation test formatting', async () => {
  const path = new URL('./invitationAccess.test.js', import.meta.url);
  const source = await fs.readFile(path, 'utf8');
  const filepath = path.pathname;
  const config = (await prettier.resolveConfig(filepath)) ?? {};
  const formatted = await prettier.format(source, { ...config, filepath });
  console.log('PRETTIER_CONFIG_DUMP_START');
  console.log(formatted);
  console.log('PRETTIER_CONFIG_DUMP_END');
});
