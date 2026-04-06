#!/usr/bin/env node
/**
 * npm hoists `expo-font` to `node_modules/expo-font`, but some CocoaPods/Xcode
 * setups still expect `node_modules/expo/node_modules/expo-font`.
 * This symlink keeps both paths valid. Safe no-op if a real nested folder exists.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const linkDir = path.join(root, 'node_modules', 'expo', 'node_modules');
const linkPath = path.join(linkDir, 'expo-font');
const targetPath = path.join(root, 'node_modules', 'expo-font');

if (!fs.existsSync(targetPath)) {
  console.warn('[ensure-expo-font-symlink] Skip: expo-font not found at', targetPath);
  process.exit(0);
}

fs.mkdirSync(linkDir, { recursive: true });

if (fs.existsSync(linkPath)) {
  let st;
  try {
    st = fs.lstatSync(linkPath);
  } catch {
    process.exit(0);
  }
  if (st.isSymbolicLink()) {
    const cur = fs.readlinkSync(linkPath);
    const resolved = path.resolve(linkDir, cur);
    if (resolved === targetPath) process.exit(0);
    fs.unlinkSync(linkPath);
  } else if (st.isDirectory()) {
    process.exit(0);
  }
}

try {
  const rel = path.relative(linkDir, targetPath);
  fs.symlinkSync(rel, linkPath, 'dir');
  console.log('[ensure-expo-font-symlink] OK', rel);
} catch (e) {
  console.warn('[ensure-expo-font-symlink]', e instanceof Error ? e.message : e);
}
