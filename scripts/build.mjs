import fs from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
await fs.rm(path.join(root,'dist'), {recursive:true,force:true});
await fs.mkdir(path.join(root,'dist'), {recursive:true});
for (const file of ['index.html','styles.css','app.js']) await fs.copyFile(path.join(root,file),path.join(root,'dist',file));
console.log('Static assets copied to dist/. Dynamic API runs with npm start.');
