const fs = require('fs');
const lighthouse = require('lighthouse');
const puppeteer = require('puppeteer');

const chromeLauncher = require('chrome-launcher');
const reportGenerator = require('lighthouse/report/report-generator');
const request = require('request');
const util = require('util');

const options = {
  logLevel: 'info',
  disableDeviceEmulation: true,
  chromeFlags: ['--disable-mobile-emulation']
};

async function lighthouseFromPuppeteer(url, options, config = null) {
  // Launch chrome using chrome-launcher
  const chrome = await chromeLauncher.launch(options);
  options.port = chrome.port;

  // Connect chrome-launcher to puppeteer
  const resp = await util.promisify(request)(`http://localhost:${options.port}/json/version`);
  const { webSocketDebuggerUrl } = JSON.parse(resp.body);
  const browser = await puppeteer.connect({ browserWSEndpoint: webSocketDebuggerUrl });

  // Run Lighthouse
  const { lhr } = await lighthouse(url, options, config);
  await browser.disconnect();
  await chrome.kill();

  const json = reportGenerator.generateReport(lhr, 'json');

  fs.writeFileSync('./audits.json', json)
  const { audits, categories } = JSON.parse(json); // Lighthouse audits and Other Performance metrics
  const first_contentful_paint = audits['first-contentful-paint'].displayValue;
  const total_blocking_time = audits['total-blocking-time'].displayValue;
  const time_to_interactive = audits['interactive'].displayValue;
  const max_potential_fid = audits['max-potential-fid'].displayValue;
  const performance = (categories.performance.score)*100;
  const accessibility = (categories.accessibility.score)*100;
  const best_practices = (categories['best-practices'].score)*100;
  const seo = (categories.seo.score)*100;

  console.log(`\n
     Core metrics:
     🌳 Peformance: ${performance},
     👁 Accesibility: ${accessibility},
     🥇 Best Practices: ${best_practices},
     🔎 SEO: ${seo},
     Other Performance metrics: 
     🎨 First Contentful Paint: ${first_contentful_paint}, 
     ⌛️ Total Blocking Time: ${total_blocking_time},
     👆 Time To Interactive: ${time_to_interactive},
     ⭐️ First Input Delay : ${max_potential_fid},
    `);
}

lighthouseFromPuppeteer("https://demo.com", options);
