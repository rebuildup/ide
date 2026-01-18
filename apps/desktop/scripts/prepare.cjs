const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..', '..');
const desktopDir = path.resolve(rootDir, 'apps', 'desktop');
const serverSrc = path.resolve(rootDir, 'apps', 'server', 'dist');
const webDist = path.resolve(rootDir, 'apps', 'web', 'dist');
const sharedSrc = path.resolve(rootDir, 'packages', 'shared');
const serverDest = path.resolve(desktopDir, 'server');
const webDest = path.resolve(desktopDir, 'web', 'dist');
const sharedDest = path.resolve(desktopDir, 'packages', 'shared');

const removeIfExists = (target) => {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
};

const copyDir = (from, to) => {
  if (!fs.existsSync(from)) {
    throw new Error(`Missing build output: ${from}`);
  }
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, { recursive: true });
};

removeIfExists(serverDest);
removeIfExists(path.resolve(desktopDir, 'web'));
removeIfExists(path.resolve(desktopDir, 'packages'));

copyDir(serverSrc, serverDest);
copyDir(webDist, webDest);
copyDir(sharedSrc, sharedDest);

console.log(`Prepared server -> ${serverDest}`);
console.log(`Prepared web dist -> ${webDest}`);
console.log(`Prepared shared -> ${sharedDest}`);
