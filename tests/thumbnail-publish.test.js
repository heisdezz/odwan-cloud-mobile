import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

// Run the actual save routine with a delayed native move, without loading RN.
function publisher(moveFails = false) {
  const source = readFileSync(new URL('../src/lib/media-thumbnails.native.ts', import.meta.url), 'utf8');
  const routine = source.slice(source.indexOf('async function saveImage'), source.indexOf('export async function getMediaThumbnail'));
  const js = new Bun.Transpiler({ loader: 'ts' }).transformSync(routine);
  let finishMove;
  const gate = new Promise((resolve) => { finishMove = resolve; });
  const disk = new Set(['file:///temporary.jpg']);
  let released = 0, moveStarted = false;
  class File {
    constructor(uri) { this.uri = uri; }
    get exists() { return disk.has(this.uri); }
    delete() { disk.delete(this.uri); }
    async move(destination) {
      moveStarted = true;
      await gate;
      if (moveFails) throw new Error('native move failed');
      if (!this.exists) throw new Error('NoSuchFileException');
      disk.delete(this.uri);
      disk.add(destination.uri);
      this.uri = destination.uri;
    }
  }
  const rendered = { saveAsync: async () => ({ uri: 'file:///temporary.jpg' }), release: () => { released++; } };
  const context = { resize() {}, renderAsync: async () => rendered, release: () => { released++; } };
  const save = new Function('ImageManipulator', 'SaveFormat', 'File', 'directory', 'fileFor', 'thumbnailDimensions', 'THUMBNAIL_QUALITY', `${js}; return saveImage;`)(
    { manipulate: () => context }, { JPEG: 'jpeg' }, File, () => ({ create() {} }), () => new File('file:///saved.jpg'), () => ({ width: 256, height: 256 }), 0.4,
  );
  return { save, disk, finishMove, released: () => released, moveStarted: () => moveStarted };
}

test('thumbnail publishing waits for the async move before cleanup and returning its URI', async () => {
  const job = publisher();
  let settled = false;
  const result = job.save({ width: 500, height: 500 }, 'key').then((uri) => { settled = true; return uri; });
  await Bun.sleep(0);
  expect(job.moveStarted()).toBe(true);
  expect(settled).toBe(false);
  expect(job.disk.has('file:///temporary.jpg')).toBe(true);
  expect(job.released()).toBe(0);
  job.finishMove();
  expect(await result).toBe('file:///saved.jpg');
  expect(job.disk.has('file:///saved.jpg')).toBe(true);
  expect(job.disk.has('file:///temporary.jpg')).toBe(false);
  expect(job.released()).toBe(2);
});

test('a rejected native move reaches the caller and cleans up the temporary JPEG', async () => {
  const job = publisher(true);
  const result = job.save({ width: 500, height: 500 }, 'key');
  job.finishMove();
  await expect(result).rejects.toThrow('native move failed');
  expect(job.disk.size).toBe(0);
  expect(job.released()).toBe(2);
});
