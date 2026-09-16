import { main } from '../server.mjs?v=full-r1-20260916';

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
