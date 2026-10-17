import 'dotenv/config';
import { createStore } from './store.js';
import { createApp } from './app.js';

const production = process.env.NODE_ENV === 'production';
if (production && !process.env.CLIENT_ORIGIN) throw new Error('CLIENT_ORIGIN is required in production.');
const store = await createStore({
  databaseUrl: process.env.DATABASE_URL,
  sslMode: process.env.DATABASE_SSL,
  production,
});
if (!store.persistent) {
  console.warn('DEVELOPMENT MEMORY MODE: player sessions and history are lost when the server restarts. Set DATABASE_URL for persistence.');
}
const server = createApp({
  store,
  production,
  clientOrigin: process.env.CLIENT_ORIGIN,
  trustProxy: process.env.TRUST_PROXY === '1',
});
const port = Number(process.env.PORT || 3001);
server.httpServer.listen(port, '0.0.0.0', () => console.log(`5 Cards listening on port ${port}`));
const shutdown = async () => {
  console.log('Closing 5 Cards server...');
  await server.close();
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
