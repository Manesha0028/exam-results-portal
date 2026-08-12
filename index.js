try {
  require("./Backend/index.js");
} catch (firstError) {
  try {
    require("./backend/index.js");
  } catch (secondError) {
    console.error("Startup failed. Could not find Backend/index.js or backend/index.js.");
    throw firstError;
  }
}
