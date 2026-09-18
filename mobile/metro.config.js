const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// @ulat/grade-math is a sibling workspace folder installed via file:; watch it
// so Metro picks up its TypeScript source (and edits to it) directly.
config.watchFolders = [path.resolve(__dirname, "../packages/grade-math")];

module.exports = config;
