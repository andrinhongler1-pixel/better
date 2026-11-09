// Normal Expo builds retain app.json. Only the GitHub Pages export adds a prefix.
module.exports = ({ config }) => {
  const base = process.env.BETTER_WEB_BASE_PATH;
  if (!base) return config;
  if (!/^\/[A-Za-z0-9_-]+$/.test(base)) throw new Error('BETTER_WEB_BASE_PATH must be /repository-name.');
  return { ...config, experiments: { ...config.experiments, baseUrl: base } };
};
