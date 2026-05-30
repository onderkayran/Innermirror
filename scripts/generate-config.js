const fs = require('fs');
const path = require('path');

const outPath = path.join(__dirname, '../public/config.js');
const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;

if (!url || !anon) {
  if (fs.existsSync(outPath)) {
    console.log('generate-config: public/config.js already exists (local dev)');
    process.exit(0);
  }
  console.warn('generate-config: SUPABASE_URL or SUPABASE_ANON_KEY missing — skip');
  process.exit(0);
}

const content = `window.INNERMIRROR_CONFIG = {
  supabaseUrl: '${url.replace(/'/g, "\\'")}',
  supabaseAnonKey: '${anon.replace(/'/g, "\\'")}',
};
`;

fs.writeFileSync(outPath, content, 'utf8');
console.log('generate-config: wrote public/config.js');
