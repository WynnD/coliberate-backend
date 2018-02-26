const dbWrapper = require('./ColiberateDBWrapper');

const url = 'mongodb://localhost:27017';

beforeEach(async () => {
  try {
    await db.dropCollectionInDB('members');
  } catch (err) {}
});

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

test('adding and removing a member in the database', async () => {
  const db = new dbWrapper(url);
  const member = {
    id: 5,
    name: 'Test Member',
    email: 'Test@example.com',
    password: 'password',
    username: 'Test@example.com'
  };
  // # of keys + 1 for _id field added by mongo
  expect.assertions(1 + Object.keys(member).length + 1 + 5);

  await db.addMember(member);

  let searchResult = await db.findMember({ id: member.id });
  expect(searchResult.length).toBe(1);
  // expect result to be equal to inserted member
  Object.keys(member).forEach(key => {
    expect(searchResult[0][key]).toEqual(member[key]);
  });

  const deleteResult = await db.deleteMember({ id: member.id });
  expect(deleteResult).toBeTruthy();
  expect(deleteResult.result).toBeDefined();
  // expect result to be equal to inserted member
  expect(deleteResult.result.n).toEqual(1);
  expect(deleteResult.result.ok).toEqual(1);
  
  searchResult = await db.findMember({ id: member.id });
  expect(searchResult.length).toBe(0);
});
