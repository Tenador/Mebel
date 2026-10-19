const fs = require('fs');
const path = require('path');
const https = require('https');

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).toString();
        return download(redirectUrl, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}: status ${res.statusCode}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function run() {
  console.log('📦 Bundling standalone offline package for USB Flash Drive...');
  const outDir = path.join(__dirname, 'ФЛЕШКА_МЕБЕЛЬ_ДЕМО');
  const imgDir = path.join(outDir, 'images');
  const jsDir = path.join(outDir, 'js');

  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(imgDir, { recursive: true });
  fs.mkdirSync(jsDir, { recursive: true });

  // 1. Copy local images from demo/images
  const srcImgDir = path.join(__dirname, 'demo', 'images');
  if (fs.existsSync(srcImgDir)) {
    const files = fs.readdirSync(srcImgDir);
    for (const f of files) {
      fs.copyFileSync(path.join(srcImgDir, f), path.join(imgDir, f));
      console.log(`✓ Copied local image: ${f}`);
    }
  }

  // 2. Download tailwind and lucide
  console.log('⬇️ Downloading Tailwind CDN...');
  await download('https://cdn.tailwindcss.com', path.join(jsDir, 'tailwind.js'));
  console.log('✓ tailwind.js downloaded');

  console.log('⬇️ Downloading Lucide CDN...');
  await download('https://unpkg.com/lucide@latest', path.join(jsDir, 'lucide.js'));
  console.log('✓ lucide.js downloaded');

  // 3. Download external Unsplash images
  const remoteImages = [
    { name: 'office_b2b.jpg', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80' },
    { name: 'restaurant_cafe.jpg', url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80' },
    { name: 'wardrobe_bedroom.jpg', url: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=80' },
    { name: 'boutique_retail.jpg', url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80' },
    { name: 'living_tv_floating.jpg', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80' },
    { name: 'factory_workshop.jpg', url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1000&q=80' },
  ];

  for (const item of remoteImages) {
    console.log(`⬇️ Downloading ${item.name}...`);
    try {
      await download(item.url, path.join(imgDir, item.name));
      console.log(`✓ ${item.name} downloaded`);
    } catch (e) {
      console.error(`Error downloading ${item.name}:`, e.message);
    }
  }

  // 4. Create local offline index.html
  let html = fs.readFileSync(path.join(__dirname, 'demo', 'index.html'), 'utf8');

  // Replace scripts
  html = html.replace('https://cdn.tailwindcss.com', 'js/tailwind.js');
  html = html.replace('https://unpkg.com/lucide@latest', 'js/lucide.js');

  // Replace remote image URLs with local image references
  html = html.replace(/https:\/\/images\.unsplash\.com\/photo-1497366216548-37526070297c[^\"]*/g, 'images/office_b2b.jpg');
  html = html.replace(/https:\/\/images\.unsplash\.com\/photo-1517248135467-4c7edcad34c4[^\"]*/g, 'images/restaurant_cafe.jpg');
  html = html.replace(/https:\/\/images\.unsplash\.com\/photo-1616486338812-3dadae4b4ace[^\"]*/g, 'images/wardrobe_bedroom.jpg');
  html = html.replace(/https:\/\/images\.unsplash\.com\/photo-1441986300917-64674bd600d8[^\"]*/g, 'images/boutique_retail.jpg');
  html = html.replace(/https:\/\/images\.unsplash\.com\/photo-1600585154340-be6161a56a0c[^\"]*/g, 'images/living_tv_floating.jpg');
  html = html.replace(/https:\/\/images\.unsplash\.com\/photo-1581092160607-ee22621dd758[^\"]*/g, 'images/factory_workshop.jpg');

  // Also write to outDir/index.html
  fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
  console.log('✓ ФЛЕШКА_МЕБЕЛЬ_ДЕМО/index.html created (100% offline self-contained)');

  // Also update demo/ so both are in sync
  fs.copyFileSync(path.join(outDir, 'index.html'), path.join(__dirname, 'demo', 'index.html'));
  fs.mkdirSync(path.join(__dirname, 'demo', 'js'), { recursive: true });
  fs.copyFileSync(path.join(jsDir, 'tailwind.js'), path.join(__dirname, 'demo', 'js', 'tailwind.js'));
  fs.copyFileSync(path.join(jsDir, 'lucide.js'), path.join(__dirname, 'demo', 'js', 'lucide.js'));
  for (const item of remoteImages) {
    if (fs.existsSync(path.join(imgDir, item.name))) {
      fs.copyFileSync(path.join(imgDir, item.name), path.join(srcImgDir, item.name));
    }
  }
  console.log('✓ Synced demo/ folder as well');
}

run().catch(console.error);
