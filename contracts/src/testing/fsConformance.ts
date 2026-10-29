import { FileSystemService } from '../services/fs';

export async function runFileSystemConformanceTests(
  createService: () => Promise<FileSystemService> | FileSystemService
) {
  const fs = await createService();

  // 1. Write and Read file
  const testFile = 'conformance-test.txt';
  const testContent = 'Hello Ajson Contracts Conformance!';
  await fs.writeFile(testFile, testContent);

  const readBack = await fs.readFile(testFile);
  if (readBack !== testContent) {
    throw new Error(`readFile mismatch: expected "${testContent}", got "${readBack}"`);
  }

  // 2. Exists and Stat
  const exists = await fs.exists(testFile);
  if (!exists) {
    throw new Error(`exists failed for ${testFile}`);
  }

  const stat = await fs.stat(testFile);
  if (!stat || stat.isDirectory) {
    throw new Error(`stat failed or identified file as directory`);
  }

  // 3. Rename
  const renamedFile = 'conformance-renamed.txt';
  await fs.rename(testFile, renamedFile);
  const existsOld = await fs.exists(testFile);
  const existsNew = await fs.exists(renamedFile);
  if (existsOld || !existsNew) {
    throw new Error(`rename failed: oldExists=${existsOld}, newExists=${existsNew}`);
  }

  // 4. Create Dir and Read Dir
  const testDir = 'conformance-dir';
  await fs.createDir(testDir);
  const dirFile = `${testDir}/nested.txt`;
  await fs.createFile(dirFile, 'nested data');

  const dirEntries = await fs.readDir(testDir);
  const foundNested = dirEntries.some((e) => e.name === 'nested.txt' || e.path === dirFile);
  if (!foundNested) {
    throw new Error(`readDir failed to find nested.txt in ${testDir}`);
  }

  // 5. Clean up / Delete
  await fs.delete(renamedFile);
  await fs.delete(dirFile);
  await fs.delete(testDir);

  const finalCheck = await fs.exists(renamedFile);
  if (finalCheck) {
    throw new Error(`delete failed for ${renamedFile}`);
  }

  return true;
}
