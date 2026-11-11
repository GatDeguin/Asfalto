import { main } from '../server.mjs?v=9eba410657deb1ea';

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
