const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.log('Sharp not installed. Run: npm install sharp --save-dev');
  console.log('Then run this script again: node scripts/generate-icons.js');
  process.exit(1);
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputPath = path.join(__dirname, '../public/icons/icon.svg');
const outputDir = path.join(__dirname, '../public/icons');

async function generateIcons() {
  const svgBuffer = fs.readFileSync(inputPath);

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);

    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`Generated: icon-${size}x${size}.png`);
  }

  // Also generate favicon
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(outputDir, '../favicon.ico'));

  console.log('Generated: favicon.ico');
  console.log('Done!');
}

generateIcons().catch(console.error);
