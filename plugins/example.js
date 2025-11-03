module.exports = {
  id: 'example-plugin',
  name: 'Example Plugin',
  version: '0.0.1',
  onResponse(flow, ctx) {
    if (flow.responseStatus === 404) {
      ctx.addFinding({ type: 'passive', title: '404 Not Found detected', severity: 'info', url: flow.url, plugin: 'Example Plugin' });
    }
  },
};

