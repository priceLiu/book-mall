export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { applyToolWebProductionOriginDefaults } = await import(
      "./lib/production-origin"
    );
    applyToolWebProductionOriginDefaults();
  }
}
