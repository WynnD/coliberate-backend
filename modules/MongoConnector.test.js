// outputs any remaining connections every 30 seconds, if any
require('leaked-handles').set({
  fullStack: true, // use full stack traces
  timeout: 30000, // run every 30 seconds instead of 5.
  debugSockets: true // pretty print tcp thrown exceptions.
});

const url = 'mongodb://localhost:27017';
const dbName = 'coliberate-test';
const MongoConnector = require('./MongoConnector');

test('connects to and closes connection to mongo server', async () => {
  const connector = new MongoConnector(url, dbName);
  const connectionInstance = await connector.connectionInstance;
  expect(connectionInstance).toBeTruthy();
  expect(connectionInstance.s.url).toBe(url);
  
  await connector.closeConnection();
  expect(connector._connectInstance).toBeFalsy();
});

test('connects to coliberate database in mongo', async () => {
  const connector = new MongoConnector(url, dbName);
  const dbInstance = await connector.databaseInstance;
  expect(dbInstance).toBeTruthy();
  expect(dbInstance.s.databaseName).toBe(dbName);

  await connector.closeConnection();
  expect(connector._dbInstance).toBeFalsy();
});
