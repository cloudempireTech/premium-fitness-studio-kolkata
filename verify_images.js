const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const htmlFiles = fs.readdirSync(baseDir).filter(f => f.endsWith('.html'));

let totalChecks = 0;
let errors = 0;

console.log('--- SCANNING ALL HTML FILES FOR ASSETS ---');

htmlFiles.forEach(file => {
  const content = fs.readFileSync(path.join(baseDir, file), 'utf8');
  
  // Find all src and href attributes pointing to assets
  const srcMatches = [...content.matchAll(/src=["']([^"']+)["']/g)];
  const hrefMatches = [...content.matchAll(/href=["'](assets\/[^"']+)["']/g)];

  const assets = [...srcMatches.map(m => m[1]), ...hrefMatches.map(m => m[1])];

  assets.forEach(assetPath => {
    // Ignore external urls or hash anchors
    if (assetPath.startsWith('http') || assetPath.startsWith('#') || assetPath.startsWith('mailto:') || assetPath.startsWith('tel:')) {
      return;
    }

    totalChecks++;
    const resolved = path.join(baseDir, assetPath);
    if (!fs.existsSync(resolved)) {
      console.error(`❌ MISSING ASSET in ${file}: "${assetPath}" -> ${resolved}`);
      errors++;
    }
  });
});

console.log(`Scan completed: ${totalChecks} asset references checked.`);
if (errors === 0) {
  console.log('✓ ZERO MISSING IMAGES OR ASSETS! All files verified.');
  process.exit(0);
} else {
  console.error(`❌ ${errors} missing asset references found!`);
  process.exit(1);
}
