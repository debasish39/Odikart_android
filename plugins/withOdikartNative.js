const {
  withAndroidManifest,
  withDangerousMod,
} = require("expo/config-plugins");

const fs = require("fs");
const path = require("path");

// 1. Restore Odikart custom Android resources
function copyDirectory(source, destination) {
  if (!fs.existsSync(source)) return;

  fs.mkdirSync(destination, { recursive: true });

  for (const item of fs.readdirSync(source, {
    withFileTypes: true,
  })) {
    const src = path.join(source, item.name);
    const dest = path.join(destination, item.name);

    if (item.isDirectory()) {
      copyDirectory(src, dest);
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

const withOdiKartNative = (config) => {
  // 2. Apply Android manifest customizations
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    // Add only your required custom manifest
    // configurations here.

    return config;
  });

  // 3. Restore custom resources
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const root = config.modRequest.projectRoot;

      const source = path.join(root, "native-resources", "android", "res");

      const destination = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
      );

      copyDirectory(source, destination);

      console.log("[OdiKart] Custom Android resources restored");

      return config;
    },
  ]);

  return config;
};

module.exports = withOdiKartNative;
