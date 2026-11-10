import { main } from '../server.mjs?v=5a11a063822d96e9';

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
