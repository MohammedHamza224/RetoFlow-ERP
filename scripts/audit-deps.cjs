const fs = require('fs');
const path = require('path');

function walk(dir) {
  const list = fs.readdirSync(dir);
  for (const f of list) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
    } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      const content = fs.readFileSync(p, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('useEffect(') || line.includes('useCallback(')) {
          // Check subsequent 10 lines for dependency array
          const slice = lines.slice(idx, idx + 15).join('\n');
          const depMatch = slice.match(/\],\s*\[([^\]]*)\]/);
          if (depMatch) {
            const deps = depMatch[1];
            if (deps.includes('cached') || deps.includes('metrics')) {
              console.log(`${p}:${idx + 1} -> deps: [${deps}]`);
            }
          }
        }
      });
    }
  }
}

console.log('Auditing src directory...');
walk(path.join(__dirname, '..', 'src'));
console.log('Done audit.');
