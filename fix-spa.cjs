const fs = require("fs");
const path = require("path");

const distPath = path.join(__dirname, "dist");
const assetsPath = path.join(distPath, "assets");

if (!fs.existsSync(assetsPath)) {
  console.error("Assets directory not found at " + assetsPath);
  process.exit(1);
}

const files = fs.readdirSync(assetsPath);

// Sort JS files by size descending to find the main bundle
const jsFiles = files
  .filter((f) => f.startsWith("index-") && f.endsWith(".js"))
  .map((f) => ({ name: f, size: fs.statSync(path.join(assetsPath, f)).size }))
  .sort((a, b) => b.size - a.size);

const mainJs = jsFiles.length > 0 ? jsFiles[0].name : null;
const mainCss = files.find((f) => f.startsWith("styles-") && f.endsWith(".css"));

if (!mainJs || !mainCss) {
  console.error("Main JS or CSS not found. Files in assets: " + files.join(", "));
  process.exit(1);
}

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Gather | Frictionless Video Meetings</title>
    <link rel="stylesheet" href="/assets/${mainCss}">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/${mainJs}"></script>
  </body>
</html>`;

fs.writeFileSync(path.join(distPath, "index.html"), html);
const clientIndex = path.join(distPath, "client", "index.html");
if (fs.existsSync(path.dirname(clientIndex))) {
  fs.writeFileSync(clientIndex, html);
}
console.log("Successfully generated index.html in dist/ and dist/client/");
console.log("Main JS: " + mainJs);
console.log("Main CSS: " + mainCss);
