import { createLocalPersistenceAdapter } from '../server/adapters/persistence-local.js';

const adapter = createLocalPersistenceAdapter();

adapter.reset().then((data) => {
  console.log(`Reset complete: ${data.locations.length} locations loaded from seed.`);
}).catch((error) => {
  console.error('Reset failed', error);
  process.exit(1);
});
