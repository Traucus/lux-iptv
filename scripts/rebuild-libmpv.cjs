'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.join(__dirname, '..');
const electronPkg = require(path.join(root, 'node_modules', 'electron', 'package.json'));
const isWin = process.platform === 'win32';

const result = spawnSync(
  isWin ? 'npx.cmd' : 'npx',
  [
    '--yes',
    'node-gyp@13',
    'rebuild',
    `--target=${electronPkg.version}`,
    '--dist-url=https://www.electronjs.org/headers',
  ],
  {
    cwd: path.join(root, 'native', 'lux-libmpv'),
    stdio: 'inherit',
    shell: isWin,
  },
);

process.exit(result.status === null ? 1 : result.status);
