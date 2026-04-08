const fs = require('fs');
const path = require('path');

function walk(dir) {
  try {
    fs.readdirSync(dir).forEach(f => {
      const p = path.join(dir, f);
      try {
        if (fs.statSync(p).isDirectory()) walk(p);
        else {
          const content = fs.readFileSync(p, 'utf8');
          if (content.includes('moduleSummaryItemsWithStock')) {
            console.log('FOUND:', p);
          }
        }
      } catch(e) {}
    });
  } catch(e) {}
}

console.log('Searching...');
walk('C:/Users/huy.dang/AppData/Roaming/Code/User/History');
console.log('Done.');
