const dbWrapper = require('./ColiberateDBWrapper');

const url = 'mongodb://localhost:27017';

test('connects to mongo server', async () => {
  expect.assertions(2);
  const db = new dbWrapper(url);
  const connectionInstance = await db.getConnectionInstance();
  expect(connectionInstance).toBeTruthy();
  expect(connectionInstance.s.url).toBe(url);
});

test('connects to coliberate database in mongo', async () => {
  expect.assertions(2);
  const db = new dbWrapper(url);
  const dbInstance = await db.getDatabaseInstance();
  expect(dbInstance).toBeTruthy();
  expect(dbInstance.s.databaseName).toBe('coliberate');
});
