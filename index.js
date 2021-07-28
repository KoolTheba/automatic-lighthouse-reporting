const fs = require('fs');
const lighthouse = require('lighthouse');
const puppeteer = require('puppeteer');
const chromeLauncher = require('chrome-launcher');
const reportGenerator = require('lighthouse/report/report-generator');
const request = require('request');
const util = require('util');
const chalk = require('chalk');
const Table = require('cli-table');
const { green } = require('chalk');

const options = {
  // logLevel: 'info',
  disableDeviceEmulation: true,
  chromeFlags: ['--disable-mobile-emulation']
};

// BASED IN Addy Osmany code (https://addyosmani.com/blog/puppeteer-recipes/#lighthouse-metrics)
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
  const performance = (categories.performance.score)*100;
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

const routes = [
    "/",
    "/about-us"
];

const domains = {
    "current": "https://staging.demo.com",
    "target": "https://demo.com"
};

const displayComparation = (currentValue, targetValue) => {
    if(targetValue === currentValue) return currentValue;

    const comparedValue = parseInt(targetValue - currentValue);
    const isPositiveComparation = comparedValue > 0;
    return chalk[isPositiveComparation ? 'green' : 'red'].bold(`${currentValue} (${isPositiveComparation ? '+' : ''}${comparedValue})`);
}

(async function() {
    const reports = [];
    for (let route of routes) {
        const currentUrl = `${domains.current}${route}`;
        const currentData = await lighthouseFromPuppeteer(currentUrl, options);
        const targetUrl = `${domains.target}${route}`;
        const targetData = await lighthouseFromPuppeteer(targetUrl, options);
        const data = {route, ...currentData};
        ['performance', 'accessibility', 'best_practices', 'seo'].forEach(prop => {
            data[prop] = displayComparation(currentData[prop], targetData[prop])
        });
        reports.push(data)
    }
    console.log(chalk.bgWhite.black.bold(`Comparing ${domains.current} with ${domains.target}`))
    const properties = Object.keys(reports[0]);
    const table = new Table({
        head: properties
    });
    reports.forEach(report => {
        table.push(properties.map(prop => report[prop]));
    })
    console.log(table.toString());
})();
