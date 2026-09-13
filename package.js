const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const appDir = path.join(baseDir, 'app');
const distDir = path.join(baseDir, 'dist');

console.log('===================================================');
console.log('  Packaging SunPlay for LG webOS');
console.log('===================================================');

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

// Clean old IPKs
fs.readdirSync(distDir).forEach(f => {
  if (f.endsWith('.ipk')) fs.unlinkSync(path.join(distDir, f));
});

console.log('[1/2] Packaging app directory with ares-package...');
cp.execSync('ares-package "' + appDir + '" -o "' + distDir + '" --no-minify', { stdio: 'inherit', shell: 'cmd.exe' });

const ipkName = fs.readdirSync(distDir).find(f => f.endsWith('.ipk'));
if (!ipkName) {
  console.error('[ERROR] No IPK found in dist/');
  process.exit(1);
}

const ipkPath = path.join(distDir, ipkName);
const stat = fs.statSync(ipkPath);
console.log('[2/2] Verified IPK:');
console.log('  Name: ' + ipkName);
console.log('  Size: ' + (stat.size / 1024).toFixed(1) + ' KB');
console.log('  Path: ' + ipkPath);
console.log('\n[SUCCESS] Ready to install on LG webOS TV:');
console.log('  ares-install "' + ipkPath + '" -d <device>');
console.log('  ares-launch com.sunplay.native -d <device>');
