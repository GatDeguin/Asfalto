import { main } from '../server.mjs?v=a0bf97c66f8e1a23';

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
