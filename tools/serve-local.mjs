import { main } from '../server.mjs?v=f5649bc251c34d42';

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
