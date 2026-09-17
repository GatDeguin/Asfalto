import { main } from '../server.mjs?v=balance-20260917';

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
