const fs = require('fs');
const content = fs.readFileSync('supabase/seed.sql', 'utf8');

const uuidRegex = /[0-9a-zA-Z]{8}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{12}/g;
const uuids = content.match(uuidRegex) || [];

let allValid = true;
const hexRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

for (const u of uuids) {
    if (!hexRegex.test(u)) {
        console.error('INVALID UUID FOUND:', u);
        allValid = false;
    }
}

if (allValid) {
    console.log('All ' + uuids.length + ' UUIDs are valid hex.');
}
