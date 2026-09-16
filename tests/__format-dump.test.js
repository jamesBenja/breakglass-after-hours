import test from 'node:test';
import fs from 'node:fs';
import prettier from 'prettier';

test('dump exact Prettier output for ClubRegressionFixes', async () => {
  const url = new URL('../src/gameplay/ClubRegressionFixes.js', import.meta.url);
  const source = fs.readFileSync(url, 'utf8');
  const formatted = await prettier.format(source, {
    parser: 'babel',
    singleQuote: true,
    printWidth: 100,
  });
  console.log('CLUB_FORMAT_BEGIN');
  console.log(formatted);
  console.log('CLUB_FORMAT_END');
});
