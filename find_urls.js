const fs = require('fs');
const html = fs.readFileSync('demo/index.html', 'utf8');
const regex = /(?:src|href)="([^"]+)"/g;
let match;
const remotes = new Set();
while ((match = regex.exec(html)) !== null) {
  if (match[1].startsWith('http')) {
    remotes.add(match[1]);
  }
}
console.log('Total remote resources:', remotes.size);
for (const url of remotes) {
  console.log(url);
}
