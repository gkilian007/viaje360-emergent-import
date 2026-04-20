#!/usr/bin/env node
import { execSync } from 'node:child_process';

function proceed(reason) {
  console.log(`✅ Build proceeds: ${reason}`);
  process.exit(1);
}

function skip(reason, files) {
  console.log(`⏭️ Build skipped: ${reason}`);
  if (files.length) {
    console.log(files.map((file) => ` - ${file}`).join('\n'));
  }
  process.exit(0);
}

const safePatterns = [
  /^docs\//,
  /^memory\//,
  /^test_reports\//,
  /^tests\//,
  /^\.emergent\//,
  /^.*\.md$/,
  /^.*\.mermaid$/,
  /^.*\.DS_Store$/,
  /^backend_test\.py$/,
  /^system_desing\.json$/,
  /^prd\.json$/,
];

const env = process.env.VERCEL_ENV;
if (!env) {
  proceed('not running inside Vercel');
}

let changedFiles = [];
try {
  const output = execSync('git diff --name-only HEAD^ HEAD', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  changedFiles = output ? output.split('\n').map((line) => line.trim()).filter(Boolean) : [];
} catch (error) {
  proceed('could not read commit diff safely');
}

if (!changedFiles.length) {
  proceed('no changed files detected');
}

const allSafe = changedFiles.every((file) => safePatterns.some((pattern) => pattern.test(file)));

if (allSafe) {
  skip('only docs or non-runtime metadata changed', changedFiles);
}

proceed('application-impacting files changed');
