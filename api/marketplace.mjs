import { createVercelProxyHandler } from "./_proxy.mjs";

const handler = createVercelProxyHandler();

export default {
  fetch(request) {
    return handler(request);
  },
};
