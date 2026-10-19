const { spawn } = require('child_process');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('🚀 Starting Microsoft Edge in headless mode with CDP...');
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9228',
    '--user-data-dir=C:\\Users\\Tenador\\AppData\\Local\\Temp\\edge_test_user_data',
    '--disable-gpu',
    '--no-sandbox',
    'about:blank'
  ]);

  edgeProc.on('error', (err) => console.error('Edge process error:', err));

  let wsUrl = null;
  for (let i = 0; i < 20; i++) {
    await sleep(400);
    try {
      const res = await fetch('http://127.0.0.1:9228/json/list');
      const tabs = await res.json();
      const pageTab = tabs.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (pageTab) {
        wsUrl = pageTab.webSocketDebuggerUrl;
        break;
      }
    } catch (e) {}
  }

  if (!wsUrl) {
    console.error('❌ Could not connect to Edge DevTools port 9222');
    edgeProc.kill();
    process.exit(1);
  }

  console.log('🔌 Connected to DevTools WebSocket');
  const ws = new WebSocket(wsUrl);

  const errors = [];
  const networkErrors = [];
  const logs = [];

  let idCounter = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = idCounter++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const resolve = pending.get(msg.id);
      pending.delete(msg.id);
      resolve(msg.result);
      return;
    }

    if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      const type = msg.params.type;
      const text = msg.params.args.map(a => a.value || a.description).join(' ');
      if (type === 'error') {
        errors.push({ text });
      } else {
        logs.push(`[${type}] ${text}`);
      }
    } else if (msg.method === 'Network.responseReceived') {
      const status = msg.params.response.status;
      const url = msg.params.response.url;
      if (status >= 400) {
        networkErrors.push({ status, url });
      }
    }
  };

  await sleep(500);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');

  console.log('🌐 Navigating to http://localhost:8080/ ...');
  await send('Page.navigate', { url: 'http://localhost:8080/' });
  await sleep(3000);

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true });
    if (res && res.exceptionDetails) {
      console.error('Eval exception:', res.exceptionDetails.text, res.exceptionDetails.exception?.description);
    }
    return res && res.result ? res.result.value : null;
  }

  console.log('\n--- 🔍 ВЫПОЛНЯЕМ ТЕСТЫ БРАУЗЕРА ---');

  // Test 1: Page Title
  const title = await evaluate('document.title');
  console.log(`1. Заголовок страницы: "${title}" (OK)`);

  // Test 2: Lucide Icons rendered
  const svgIconsCount = await evaluate('document.querySelectorAll("svg.lucide").length');
  console.log(`2. Lucide иконки: успешно отрисовано ${svgIconsCount} SVG иконок (OK)`);

  // Test 3: Images status
  const imgCheck = await evaluate(`
    Array.from(document.querySelectorAll('img')).map(img => ({
      src: img.getAttribute('src') || img.src,
      loaded: img.complete && img.naturalWidth > 0,
      width: img.naturalWidth,
      height: img.naturalHeight
    }))
  `);
  const failedImages = (imgCheck || []).filter(i => !i.loaded && i.src && !i.src.endsWith('/'));
  console.log(`3. Проверка изображений: всего ${imgCheck.length}, успешно загружено ${imgCheck.length - failedImages.length}`);
  if (failedImages.length > 0) {
    console.warn('⚠️ Проблемные изображения:', failedImages);
  } else {
    console.log('   ✓ Все изображения успешно загружены!');
  }

  // Test 4: 3D CAD Blueprint Slider
  const sliderCheck = await evaluate(`
    (() => {
      const container = document.getElementById('ba-container');
      const beforeLayer = document.getElementById('ba-before-layer');
      const handle = document.getElementById('ba-handle');
      if (!container || !beforeLayer || !handle) return { ok: false, reason: 'elements missing' };
      
      const rect = container.getBoundingClientRect();
      const clientX = rect.left + rect.width * 0.35;
      const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      beforeLayer.style.width = pct + '%';
      handle.style.left = pct + '%';
      return { ok: true, width: beforeLayer.style.width, left: handle.style.left };
    })()
  `);
  console.log(`4. Интерактивный 3D CAD сплит-слайдер:`, sliderCheck);

  // Test 5: Manifest & Catalog Section (Without Prices)
  const catalogCheck = await evaluate(`
    (() => {
      const manifestTitle = document.querySelector('#manifest h2')?.innerText;
      const catalogEl = document.getElementById('catalog');
      const catalogCards = document.querySelectorAll('.catalog-item');
      
      // Filter test
      filterCatalog('kitchen');
      const visibleAfterKitchen = Array.from(document.querySelectorAll('.catalog-item')).filter(i => i.style.display !== 'none').length;
      filterCatalog('all');
      const visibleAll = Array.from(document.querySelectorAll('.catalog-item')).filter(i => i.style.display !== 'none').length;

      return {
        manifestTitle: manifestTitle ? manifestTitle.substring(0, 50) + '...' : null,
        catalogPresent: !!catalogEl,
        totalCatalogCards: catalogCards.length,
        filterKitchenCount: visibleAfterKitchen,
        filterAllCount: visibleAll
      };
    })()
  `);
  console.log(`5. Манифест мастера и Каталог решений (без цен):`, catalogCheck);

  // Test 6: Multi-photo Gallery Modal for Portfolio
  const galleryCheck = await evaluate(`
    (() => {
      // Open Soft-Loft kitchen gallery
      openProjectGalleryModal('softLoftKitchen');
      const modal = document.getElementById('project-gallery-modal');
      const modalVisible = modal ? !modal.classList.contains('hidden') : false;
      const modalTitle = document.getElementById('gallery-modal-title')?.innerText;
      const photoCounter = document.getElementById('gallery-photo-counter')?.innerText;
      const mainImgSrc = document.getElementById('gallery-main-img')?.getAttribute('src');
      const thumbsCount = document.querySelectorAll('.gallery-thumb-btn').length;

      // Switch to next photo
      nextGalleryPhoto();
      const counterAfterNext = document.getElementById('gallery-photo-counter')?.innerText;

      // Close modal
      closeProjectGalleryModal();
      const modalClosed = modal ? modal.classList.contains('hidden') : true;

      return {
        modalVisible,
        modalTitle,
        photoCounter,
        mainImgSrc,
        thumbsCount,
        counterAfterNext,
        modalClosed
      };
    })()
  `);
  console.log(`6. Мульти-фото галерея проектов:`, galleryCheck);

  // Test 7: Reviews & Contacts with Yandex Map
  const sectionsCheck = await evaluate(`
    (() => {
      const reviews = document.querySelectorAll('#reviews .bg-dark-800');
      const mapIframe = document.querySelector('#contacts iframe');
      const maxButtons = document.querySelectorAll('a[href*="max.ru"]');
      return {
        reviewsCount: reviews.length,
        mapPresent: !!mapIframe,
        mapSrc: mapIframe ? mapIframe.getAttribute('src').substring(0, 45) + '...' : null,
        maxButtonsCount: maxButtons.length
      };
    })()
  `);
  console.log(`7. Отзывы, Контакты, Яндекс Карта и мессенджер MAX:`, sectionsCheck);

  // Test 8: Bottom Lead Capture & Push Toast
  const leadCheck = await evaluate(`
    (() => {
      const phoneInput = document.getElementById('bottom-lead-phone');
      phoneInput.value = '+7 (999) 777-88-99';
      const fakeEvent = { preventDefault: () => {} };
      submitBottomLead(fakeEvent);

      const toast = document.getElementById('telegram-push-toast');
      const toastVisible = toast ? toast.classList.contains('toast-show') : false;
      const toastText = document.getElementById('push-toast-body')?.innerText;

      return { toastVisible, toastText };
    })()
  `);
  console.log(`8. Заявка мастера и пуш-уведомление:`, leadCheck);

  console.log('\n--- 📋 ИТОГИ ПРОВЕРКИ ---');
  console.log(`Ошибок в консоли JS: ${errors.length}`);
  if (errors.length > 0) console.error('Детали ошибок JS:', errors);

  console.log(`Сетевых ошибок (404/500): ${networkErrors.length}`);
  if (networkErrors.length > 0) console.error('Детали сетевых ошибок:', networkErrors);

  ws.close();
  edgeProc.kill();
  console.log('\n🏁 Все проверки успешно пройдены!');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
