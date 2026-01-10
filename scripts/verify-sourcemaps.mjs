import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const assetsDir = path.resolve(process.cwd(), 'dist', 'assets');
const sourceMapRegex = /sourceMappingURL=(.+)$/m;

const main = async () => {
  const entries = await readdir(assetsDir);
  const maps = new Set(entries.filter((entry) => entry.endsWith('.map')));
  const jsFiles = entries.filter((entry) => entry.endsWith('.js'));

  const missing = [];
  for (const file of jsFiles) {
    const contents = await readFile(path.join(assetsDir, file), 'utf8');
    const match = contents.match(sourceMapRegex);
    if (!match) continue;
    const referenced = match[1].trim();
    if (!maps.has(referenced)) {
      missing.push({ file, referenced });
    }
  }

  if (missing.length > 0) {
    console.error('Missing sourcemaps referenced by bundles:');
    missing.forEach((entry) => {
      console.error(`- ${entry.file} -> ${entry.referenced}`);
    });
    process.exit(1);
  }

  console.log(`Sourcemap verification complete. Found ${maps.size} map(s).`);
};

main().catch((error) => {
  console.error('Sourcemap verification failed.', error);
  process.exit(1);
});
