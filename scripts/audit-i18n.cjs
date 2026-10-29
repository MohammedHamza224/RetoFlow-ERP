const fs = require('fs');
const path = require('path');

const en = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/i18n/locales/en.json'), 'utf8'));
const ar = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/i18n/locales/ar.json'), 'utf8'));

function getKeys(obj, prefix = '') {
  let keys = [];
  for (const k in obj) {
    if (typeof obj[k] === 'object' && obj[k] !== null) {
      keys = keys.concat(getKeys(obj[k], prefix ? `${prefix}.${k}` : k));
    } else {
      keys.push(prefix ? `${prefix}.${k}` : k);
    }
  }
  return keys;
}

const enKeys = new Set(getKeys(en));
const arKeys = new Set(getKeys(ar));
const missingInAr = [...enKeys].filter(k => !arKeys.has(k));
const missingInEn = [...arKeys].filter(k => !enKeys.has(k));

console.log('--- Translation Key Parity ---');
console.log(`Total EN keys: ${enKeys.size}`);
console.log(`Total AR keys: ${arKeys.size}`);
if (missingInAr.length > 0) console.error('MISSING IN AR:', missingInAr);
if (missingInEn.length > 0) console.error('MISSING IN EN:', missingInEn);
if (missingInAr.length === 0 && missingInEn.length === 0) {
  console.log('✅ PERFECT PARITY: All keys match 100% between EN and AR!\n');
}

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walk(filePath, fileList);
    } else if (file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const files = walk(path.join(__dirname, '../src/components'));

console.log(`\nDeep multiline scanning ${files.length} React components for hardcoded English strings...\n`);

const ignoreWords = new Set([
  'RestoFlow', 'Resto', 'Flow', 'RMS', 'SAR', 'VAT', 'POS', 'SKU', 'AI', 'RAG', 'ID', 'UUID', 'URL', 'LTR', 'RTL', 'PDF', 'CSV', 'DOCX', 'SOP', 'FAQ',
  'MADA', 'VISA', 'ADMIN', 'MANAGER', 'CASHIER', 'STAFF', 'DINE_IN', 'TAKEAWAY', 'DELIVERY', 'CASH', 'CARD', 'APPLE_PAY', 'OTHER',
  'AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED',
  'PAID', 'UNPAID', 'REFUNDED', 'DRAFT', 'RECEIVED', 'PARTIALLY_RECEIVED', 'APPROVED', 'IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK',
  'CUSTOMER_REQUEST', 'OUT_OF_STOCK', 'DUPLICATE_ORDER', 'WRONG_ORDER',
  'OPERATIONS', 'INVENTORY', 'PURCHASING', 'MANAGEMENT', 'CANCELLATION_REFUND', 'HR', 'GENERAL', 'POLICY', 'MANUAL_TEXT',
  'true', 'false', 'null', 'undefined', 'className', 'variant', 'size', 'type', 'key', 'id', 'name', 'value', 'children',
  'Promise', 'React', 'FC', 'HTMLDivElement', 'HTMLButtonElement', 'ChangeEvent', 'FormEvent', 'MouseEvent'
]);

for (const file of files) {
  const relPath = path.relative(path.join(__dirname, '..'), file);
  const content = fs.readFileSync(file, 'utf8');
  const findings = [];

  // Match JSX text: >\s*([A-Za-z][^<>{}]*)\s*< across newlines
  const textMatches = content.matchAll(/>\s*([A-Za-z][^<>{}\n\r\t]+[A-Za-z0-9])\s*</g);
  for (const m of textMatches) {
    const text = m[1].trim();
    if (!ignoreWords.has(text) && !/^[0-9\s.,\/:%&+\-–—#()]+$/.test(text) && text.length > 2) {
      if (!text.includes('from ') && !text.includes('import ') && !text.includes('return ') && !text.includes('interface ')) {
        const lineNum = content.slice(0, m.index).split('\n').length;
        findings.push({ lineNum, type: 'JSX Text', text });
      }
    }
  }

  // Placeholders
  const placeholderMatches = content.matchAll(/placeholder=["']([A-Za-z][^"']+)["']/g);
  for (const m of placeholderMatches) {
    const text = m[1].trim();
    if (!ignoreWords.has(text) && !text.startsWith('{') && text.length > 2) {
      const lineNum = content.slice(0, m.index).split('\n').length;
      findings.push({ lineNum, type: 'placeholder', text });
    }
  }

  // Alerts
  const alertMatches = content.matchAll(/alert\(["']([^"']+)["']\)/g);
  for (const m of alertMatches) {
    const text = m[1].trim();
    const lineNum = content.slice(0, m.index).split('\n').length;
    findings.push({ lineNum, type: 'alert', text });
  }

  // Titles & Labels as attributes: title="English", label="English"
  const titleMatches = content.matchAll(/(title|label|heading|description)=["']([A-Z][a-zA-Z0-9\s,&'.-]{3,})["']/g);
  for (const m of titleMatches) {
    const attr = m[1];
    const text = m[2].trim();
    if (!ignoreWords.has(text)) {
      const lineNum = content.slice(0, m.index).split('\n').length;
      findings.push({ lineNum, type: `attr:${attr}`, text });
    }
  }

  if (findings.length > 0) {
    console.log(`\n📄 ${relPath} (${findings.length} findings):`);
    findings.forEach(f => {
      console.log(`  Line ${f.lineNum} [${f.type}]: "${f.text}"`);
    });
  }
}
