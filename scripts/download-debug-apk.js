import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const [resultPath, outputPath] = process.argv.slice(2);
if (!resultPath || !outputPath) throw new Error('Expected build result path and APK output path.');
const builds = await Bun.file(resultPath).json();
const build = builds.find((item) => item.platform === 'ANDROID');
if (build?.status !== 'FINISHED') throw new Error('The Android build did not finish successfully.');
const url = new URL(build.artifacts?.applicationArchiveUrl ?? build.artifacts?.buildUrl);
if (url.protocol !== 'https:') throw new Error('EAS must return an HTTPS artifact URL.');
await mkdir(dirname(outputPath), { recursive: true });
const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
if (!response.ok || !response.body) throw new Error(`APK download failed (${response.status}).`);
await Bun.write(outputPath, response);
console.log(`Saved debug APK to ${outputPath}`);
