import { main } from '../server.mjs?v=400-review-r144-20260917';

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
