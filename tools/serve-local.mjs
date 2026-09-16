import { main } from '../server.mjs?v=body-r2-20260916';

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
