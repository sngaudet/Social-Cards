const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// ignore large non-app folders so expo go can load fast and reliably
config.resolver.blockList =
  /backend\/.*|\.local-backups\/.*|node_modules_broken_.*\/.*|ios\/Pods\/.*|ios\/build\/.*|android\/.*/;

module.exports = config;
