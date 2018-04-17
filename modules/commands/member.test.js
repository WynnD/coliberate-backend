// outputs any remaining connections every 30 seconds, if any
require('leaked-handles').set({
  fullStack: true, // use full stack traces
  timeout: 30000, // run every 30 seconds instead of 5.
  debugSockets: true // pretty print tcp thrown exceptions.
});

const MongoConnector = require('../MongoConnector');

const MemberCommand = require('./member');

const url = 'mongodb://localhost:27017';

const memberCommand = new MemberCommand(new MongoConnector(url, 'coliberate'));

beforeEach(async () => {
  // empty
  try {
    await memberCommand.drop();
    // eslint-disable-next-line no-empty
  } catch (err) { }
});

afterAll(async () => {
  try {
    await memberCommand.drop();
    // eslint-disable-next-line no-empty
  } catch (err) { }

  try {
    await memberCommand.closeConnection();
  } catch (err) { 
    // eslint-disable-next-line no-console
    console.error('Error closing connection', err);
  }
});

test('adding and removing a member in the database', async () => {
  const member = {
    id: '5',
    name: 'Test Member',
    email: 'Test@example.com',
    password: 'password',
    username: 'Test@example.com',
    description: 'the member description',
    skills: [
      {
        name: 'JavaScript',
        interested: true,
        experience: 2
      },
      {
        name: 'Go',
        interested: true,
        experience: 0
      },
      {
        name: 'SmallTalk',
        interested: false,
        experience: 1
      }
    ]
  };

  // # of keys + 1 for _id field added by mongo
  expect.assertions(1 + Object.keys(member).length + 1 + 5);

  await memberCommand.add(member);

  let searchResult = await memberCommand.find({ id: member.id });
  expect(searchResult.length).toBe(1);
  // expect result to be equal to inserted member
  Object.keys(member).forEach(key => {
    expect(searchResult[0][key]).toEqual(member[key]);
  });

  const deleteResult = await memberCommand.delete({ id: member.id });
  expect(deleteResult).toBeTruthy();
  expect(deleteResult.result).toBeDefined();
  expect(deleteResult.result.n).toEqual(1);
  expect(deleteResult.result.ok).toEqual(1);

  searchResult = await memberCommand.find({ id: member.id });
  expect(searchResult.length).toBe(0);
});
