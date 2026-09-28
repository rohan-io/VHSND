// Extends app.json (Expo merges the two automatically: this function receives
// app.json's content as `config`). Only reason this file exists: Android
// cleartext (plain http://) traffic must be allowed for the "lan-dev" EAS
// build profile (testing against a laptop on the local network) and blocked
// everywhere else, including "hosted" (which talks to the real server over
// https://). eas.json sets EXPO_PUBLIC_ALLOW_CLEARTEXT=true only on the
// "lan-dev" profile.
const ALLOW_CLEARTEXT = process.env.EXPO_PUBLIC_ALLOW_CLEARTEXT === "true";

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins || []),
    ...(ALLOW_CLEARTEXT
      ? [["expo-build-properties", { android: { usesCleartextTraffic: true } }]]
      : []),
  ],
});
