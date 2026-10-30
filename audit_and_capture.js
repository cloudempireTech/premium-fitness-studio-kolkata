const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

// Mandatory 180s watchdog
const watchdog = setTimeout(() => {
  console.error('ERROR: 180s Watchdog triggered in audit_and_capture.js!');
  process.exit(1);
}, 180000);
watchdog.unref();

const rootDir = __dirname;
const screenshotsDir = path.join(rootDir, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Simple static HTTP server
function startServer(port = 8089) {
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4'
  };

  const server = http.createServer((req, res) => {
    let reqPath = decodeURI(req.url.split('?')[0]);
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(rootDir, reqPath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    }
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Test server running at http://localhost:${port}`);
      resolve(server);
    });
  });
}

async function runAudit() {
  const port = 8089;
  const server = await startServer(port);
  const baseUrl = `http://localhost:${port}`;

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const viewports = [
    { name: 'Android 360', width: 360, height: 800 },
    { name: 'iOS SE 375', width: 375, height: 667 },
    { name: 'iOS iPhone 12 390', width: 390, height: 844 }
  ];

  const pagesToAudit = [
    'index.html',
    'about.html',
    'offerings.html',
    'catering.html',
    'gallery.html',
    'reviews.html',
    'contact.html'
  ];

  console.log('\n--- 1. RUNNING MOBILE VIEWPORT AUDITS ---');
  for (const vp of viewports) {
    console.log(`\nTesting Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2
    });
    const page = await context.newPage();

    for (const pageName of pagesToAudit) {
      const pageUrl = `${baseUrl}/${pageName}`;
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);

      // Check 1: Zero horizontal overflow (scrollWidth === clientWidth)
      const overflowInfo = await page.evaluate(() => {
        const docEl = document.documentElement;
        const body = document.body;
        const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
        const clientWidth = docEl.clientWidth;
        
        let offendingElements = [];
        if (scrollWidth > clientWidth) {
          const allEls = document.querySelectorAll('*');
          for (const el of allEls) {
            const rect = el.getBoundingClientRect();
            if (rect.right > clientWidth + 1) {
              offendingElements.push({
                tag: el.tagName,
                class: el.className,
                id: el.id,
                right: rect.right,
                width: rect.width
              });
              if (offendingElements.length >= 5) break;
            }
          }
        }
        return {
          scrollWidth,
          clientWidth,
          hasOverflow: scrollWidth > clientWidth,
          offendingElements
        };
      });

      if (overflowInfo.hasOverflow) {
        console.error(`❌ OVERFLOW FAILURE on ${pageName} (${vp.name}): scrollWidth ${overflowInfo.scrollWidth} > clientWidth ${overflowInfo.clientWidth}`);
        console.error('Offending elements:', overflowInfo.offendingElements);
        process.exit(1);
      } else {
        console.log(`  ✓ ${pageName}: Zero horizontal overflow (scrollWidth === clientWidth === ${overflowInfo.clientWidth}px)`);
      }

      // Check 2: Hamburger button inside navbar and viewport bounds
      const toggleInfo = await page.evaluate(() => {
        const toggle = document.querySelector('.mobile-toggle');
        const header = document.querySelector('.site-header');
        if (!toggle) return { found: false };
        const tRect = toggle.getBoundingClientRect();
        const hRect = header ? header.getBoundingClientRect() : null;
        const winWidth = window.innerWidth;
        return {
          found: true,
          right: tRect.right,
          left: tRect.left,
          winWidth,
          insideViewport: tRect.right <= winWidth && tRect.left >= 0,
          insideHeader: hRect ? (tRect.right <= hRect.right && tRect.left >= hRect.left) : true
        };
      });

      if (toggleInfo.found && (!toggleInfo.insideViewport || !toggleInfo.insideHeader)) {
        console.error(`❌ Mobile toggle button clipped or outside bounds on ${pageName} (${vp.name})!`, toggleInfo);
        process.exit(1);
      }

      // Check 3: On offerings.html, first filter tab visible inside tab bar without clipping
      if (pageName === 'offerings.html') {
        const filterTabInfo = await page.evaluate(() => {
          const firstTab = document.querySelector('.filter-tab-btn');
          const filterBar = document.querySelector('.portfolio-filter');
          if (!firstTab || !filterBar) return null;
          const tRect = firstTab.getBoundingClientRect();
          const bRect = filterBar.getBoundingClientRect();
          return {
            tabLeft: tRect.left,
            barLeft: bRect.left,
            fullyVisible: tRect.left >= bRect.left - 2
          };
        });
        if (filterTabInfo && !filterTabInfo.fullyVisible) {
          console.error(`❌ First filter tab clipped on offerings.html (${vp.name})!`, filterTabInfo);
          process.exit(1);
        } else {
          console.log(`  ✓ offerings.html: First filter tab fully visible at left edge with zero clipping`);
        }
      }

      // Check 4: On index.html at 390x844 (iOS), verify all 4 telemetry stats fit above the fold (< 844px)
      if (pageName === 'index.html' && vp.width === 390 && vp.height === 844) {
        const statsFoldInfo = await page.evaluate(() => {
          const statsCards = document.querySelectorAll('.hero-telemetry-grid .hero-stat-card');
          if (statsCards.length < 4) return { count: statsCards.length, allAboveFold: false };
          let maxBottom = 0;
          statsCards.forEach(c => {
            const r = c.getBoundingClientRect();
            if (r.bottom > maxBottom) maxBottom = r.bottom;
          });
          return {
            count: statsCards.length,
            maxBottom,
            allAboveFold: maxBottom <= 844
          };
        });
        console.log(`  ✓ index.html Telemetry Stats: Bottom at ${statsFoldInfo.maxBottom}px (Fold at 844px). All 4 stats above fold: ${statsFoldInfo.allAboveFold}`);
        if (!statsFoldInfo.allAboveFold) {
          console.error(`❌ Hero telemetry stats pushed below 844px fold on iOS 390x844! maxBottom: ${statsFoldInfo.maxBottom}px`);
          process.exit(1);
        }
      }

      // Check 5: Card Boundary Containment (left >= 0 and right <= clientWidth)
      const cardBoundInfo = await page.evaluate(() => {
        const cards = document.querySelectorAll('.dish-card, .offering-card, .review-card, .hero-stat-card, .contact-form-card, .feature-card, .contact-info-card');
        const clientWidth = document.documentElement.clientWidth;
        let overflowCards = [];
        cards.forEach((c, idx) => {
          const r = c.getBoundingClientRect();
          if (r.left < -1 || r.right > clientWidth + 1) {
            overflowCards.push({ idx, left: r.left, right: r.right, clientWidth });
          }
        });
        return {
          totalCards: cards.length,
          overflowCount: overflowCards.length,
          overflowCards
        };
      });

      if (cardBoundInfo.overflowCount > 0) {
        console.error(`❌ Card boundary overflow on ${pageName} (${vp.name})!`, cardBoundInfo.overflowCards);
        process.exit(1);
      }
    }
    await context.close();
  }

  console.log('\n--- 2. CAPTURING 4 DESKTOP SCREENSHOTS (1280x800) ---');
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2
  });
  const desktopPage = await desktopContext.newPage();

  const screenshotsToCapture = [
    { file: 'index.html', out: 'screenshot_1_hero.png', title: 'Desktop Homepage Hero with Floating Navbar & Poster' },
    { file: 'offerings.html', out: 'screenshot_2_offerings.png', title: 'Offerings Page with Sticky Filter Rail' },
    { file: 'catering.html', out: 'screenshot_3_catering.png', title: 'Corporate Wellness & Transformation Packages' },
    { file: 'contact.html', out: 'screenshot_4_contact.png', title: 'Visiting Counter, Helplines & Location Card' }
  ];

  for (const s of screenshotsToCapture) {
    const url = `${baseUrl}/${s.file}`;
    console.log(`Capturing: ${s.out} (${s.title})...`);
    await desktopPage.goto(url, { waitUntil: 'networkidle' });
    await desktopPage.waitForTimeout(600);
    const outPath = path.join(screenshotsDir, s.out);
    await desktopPage.screenshot({ path: outPath, fullPage: false });
    const stat = fs.statSync(outPath);
    console.log(`  ✓ Saved ${s.out} (${Math.round(stat.size / 1024)} KB)`);
  }

  await desktopContext.close();
  await browser.close();
  server.close();

  console.log('\n🎉 ALL MOBILE AUDITS PASSED & ALL 4 DESKTOP SCREENSHOTS SUCCESSFULLY CAPTURED!');
}

runAudit().catch(err => {
  console.error('Audit script threw error:', err);
  process.exit(1);
});
