import { main } from '../server.mjs?v=ec9ca3d30198bdb8';

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
