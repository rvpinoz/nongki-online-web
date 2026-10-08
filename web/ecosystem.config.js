module.exports = {
  apps: [
    {
      name: "nongki-web",
      script: "npm",
      args: "start -- -p 3000",
      cwd: "/home/dev-staging/nongki-online-web/web",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
