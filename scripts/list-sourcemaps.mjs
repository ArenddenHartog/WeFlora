import { readdir } from 'node:fs/promises';
import path from 'node:path';

const assetsDir = path.resolve(process.cwd(), 'dist', 'assets');

const main = async () => {
  try {
    const entries = await readdir(assetsDir);
    const maps = entries.filter((entry) => entry.endsWith('.map'));
    if (maps.length === 0) {
      console.log('No sourcemap files found in dist/assets.');
      return;
    }
    console.log('Sourcemap files in dist/assets:');
    maps.forEach((map) => console.log(`- ${map}`));
  } catch (error) {
    console.warn('Unable to list sourcemaps in dist/assets.', error);
  }
};

main();
