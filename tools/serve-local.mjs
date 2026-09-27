import { main } from '../server.mjs?v=7e5aa644ab732c4b';

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
