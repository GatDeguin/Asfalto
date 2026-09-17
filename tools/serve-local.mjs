import { main } from '../server.mjs?v=body-r3-20260916';

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
