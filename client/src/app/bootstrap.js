import { AppState, DOM, POSTS_PER_PAGE } from './state.js';
import { actions, registerActions } from './actions.js';

const checkDatabaseConnection = (...args) => actions.checkDatabaseConnection(...args);
const checkMobileDrawerLayout = (...args) => actions.checkMobileDrawerLayout(...args);
const checkServerConnection = (...args) => actions.checkServerConnection(...args);
const initAuthEvents = (...args) => actions.initAuthEvents(...args);
const initEventListeners = (...args) => actions.initEventListeners(...args);
const initPrivateEventListeners = (...args) => actions.initPrivateEventListeners(...args);
const loadData = (...args) => actions.loadData(...args);
const refreshPlatformCounts = (...args) => actions.refreshPlatformCounts(...args);

async function bootstrapApp() {
  initEventListeners();
  initPrivateEventListeners();
  initAuthEvents();
  checkMobileDrawerLayout();
  const session = await checkServerConnection();
  if (!session.authenticated) return;
  await Promise.allSettled([checkDatabaseConnection(), refreshPlatformCounts(), loadData()]);
}

registerActions('bootstrap', { bootstrapApp });
export { bootstrapApp };
