const fs = require('fs');
let content = fs.readFileSync('supabase/seed.sql', 'utf8');

content = content.replace(/t0000000/g, 'd0000000');
content = content.replace(/s0000000/g, 'e0000000');
content = content.replace(/pi000000/g, 'f1000000');
content = content.replace(/p0000000/g, 'f0000000');
content = content.replace(/oi000000/g, 'f3000000');
content = content.replace(/o0000000/g, 'f2000000');
content = content.replace(/pay00000/g, 'f4000000');

fs.writeFileSync('supabase/seed.sql', content, 'utf8');
console.log('UUIDs fixed successfully.');
