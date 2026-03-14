async function globalTeardown() {
  console.log(`[MONITOR] Run complete: ${process.env.RUN_ID}`);
}

export default globalTeardown;
