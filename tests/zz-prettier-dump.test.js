import fs from 'node:fs/promises';
import test from 'node:test';
import prettier from 'prettier';

test('dump formatted invitation test while fixing CI', async () => {
  const path = new URL('./invitationAccess.test.js', import.meta.url);
  const source = await fs.readFile(path, 'utf8');
  const formatted = await prettier.format(source, { parser: 'babel' });
  console.log('PRETTIER_DUMP_START');
  console.log(formatted);
  console.log('PRETTIER_DUMP_END');
});
