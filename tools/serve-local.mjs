import { main } from '../server.mjs?v=2a6036fbd6ef44b2';

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
