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
  const largest_contentful_paint = audits['largest-contentful-paint'].displayValue
  const max_potential_fid = audits['max-potential-fid'].displayValue;
  const cumulative_layout_shift = audits['cumulative-layout-shift'].displayValue;
  const performance = parseFloat((categories.performance.score)*100);
  const accessibility = (categories.accessibility.score)*100;
  const best_practices = (categories['best-practices'].score)*100;
  const seo = (categories.seo.score)*100;

  return {
      "performance": performance,
      "accessibility": accessibility,
      "best_practices": best_practices,
      "seo": seo,
      "lcp": largest_contentful_paint,
      "fid": max_potential_fid,
      "cls": cumulative_layout_shift,
    }
}

const urls = [
    "https://demo.com/",
    "https://demo.com/about-us"
];

(async function() {
    const report = [];
    for (let url of urls) {
        const data = await lighthouseFromPuppeteer(url, options)
        report.push({url: url.replace('https://demo.com', ''), ...data})
    }
    console.table(report)
 })();
