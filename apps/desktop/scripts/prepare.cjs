const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..', '..');
const desktopDir = path.resolve(rootDir, 'apps', 'desktop');
const serverSrc = path.resolve(rootDir, 'apps', 'server');
const webDist = path.resolve(rootDir, 'apps', 'web', 'dist');
const serverDest = path.resolve(desktopDir, 'server');
const webDest = path.resolve(desktopDir, 'web', 'dist');

const removeIfExists = (target) => {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
};

const copyDir = (from, to) => {
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, { recursive: true });
};

removeIfExists(serverDest);
removeIfExists(path.resolve(desktopDir, 'web'));

copyDir(serverSrc, serverDest);
copyDir(webDist, webDest);

console.log(`Prepared server -> ${serverDest}`);
console.log(`Prepared web dist -> ${webDest}`);
