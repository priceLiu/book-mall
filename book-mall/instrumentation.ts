export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { applyBookMallProductionOriginDefaults } = await import(
      "./lib/production-origin"
    );
    applyBookMallProductionOriginDefaults();
  }
}
