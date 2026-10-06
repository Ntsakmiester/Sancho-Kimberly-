const c = require('crypto');
const s = c.randomBytes(16);
process.stdout.write('scrypt$16384$8$1$' + s.toString('base64') + '$' + c.scryptSync(process.argv[2], s, 64, { N: 16384, r: 8, p: 1 }).toString('base64'));
