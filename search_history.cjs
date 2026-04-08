const fs = require('fs');
const path = require('path');

function walk(dir) {
  try {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const p = path.join(dir, f);
      try {
        const stat = fs.statSync(p);
        if (stat.isDirectory()) walk(p);
        else if (stat.isFile()) {
           const content = fs.readFileSync(p, 'utf8');
           if (content.includes('check stock san pham') || content.includes('activeModule === \\'stock\\'') || content.includes('function submitStockFilter')) {
              console.log('FOUND:', p);
           }
        }
      } catch(e) {}
    }
  } catch(e) {}
}

walk('C:/Users/huy.dang/AppData/Roaming/Code/User/History');
