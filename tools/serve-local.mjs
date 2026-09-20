import { main } from '../server.mjs?v=6576bb6b70fe439f';

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
