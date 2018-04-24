// outputs any remaining connections every 30 seconds, if any
require('leaked-handles').set({
  fullStack: true, // use full stack traces
  timeout: 30000, // run every 30 seconds instead of 5.
  debugSockets: true // pretty print tcp thrown exceptions.
});

const MongoConnector = require('../MongoConnector');

const TaskCommand = require('./task');

const url = 'mongodb://localhost:27017';

const taskCommand = new TaskCommand(new MongoConnector(url, 'coliberate'));

beforeEach(async () => {
  // empty
  try {
    await taskCommand.drop();
    // eslint-disable-next-line no-empty
  } catch (err) { }
});

afterAll(async () => {
  try {
    await taskCommand.drop();
    // eslint-disable-next-line no-empty
  } catch (err) { }

  try {
    await taskCommand.closeConnection();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error closing connection', err);
  }
});

test('adding a task in the database', async () => {
  const currentDate = Date();
  const project = {
    id: 'sampleproject-0',
    name: 'Sample Project',
    description: 'Project Description. We need to figure out what data goes into projects',
    members: {
      'member-0': {
        id: 'member-0',
        role: 'Scrum Master'
      },
      'member-1': {
        id: 'member-1',
        role: 'Product Owner'
      },
      'jsmith-12313': {
        id: 'jsmith-12313',
        role: 'Developer Team'
      }
    },
    releases: {
      'release-0': {
        id: 'release-0',
        name: 'Release 0',
        description: 'Our very first release. :)',
        startDate: new Date(currentDate.valueOf() - oneWeek).toDateString(), // e.g. Mon Mar 12 2018
        endDate: new Date(new Date().valueOf() + 3 * oneWeek).toDateString(),
        features: ['feature-0', 'feature-1'], // array of feature IDs
        sprints: ['sprint-0'] // array of sprint IDs
      },
      'release-1': {
        id: 'release-1',
        name: 'Release 2.0',
        description: 'It keeps getting better and better',
        startDate: new Date(currentDate.valueOf() + 4 * oneWeek).toDateString(), // e.g. Mon Mar 12 2018
        endDate: new Date(new Date().valueOf() + 7 * oneWeek).toDateString(),
        features: [], // array of feature IDs
        sprints: [] // array of sprint IDs
      }
    },
    sprints: {
      'sprint-0': {
        // goals are defined by associated tasks and stories
        id: 'sprint-0',
        name: 'Sprint 1',
        startDate: new Date(currentDate.valueOf() - oneWeek).toDateString(), // can't be earlier than associated release
        endDate: new Date(new Date().valueOf() + oneWeek).toDateString(), // can't be later than associated release
        stories: ['story-0', 'story-1'], // array of story IDs
        tasks: ['task-3', 'task-2'] // array of tasks
      },
      'sprint-1': {
        // goals are defined by associated tasks and stories
        id: 'sprint-1',
        name: 'Sprint 2',
        startDate: new Date(currentDate.valueOf() + oneWeek).toDateString(), // can't be earlier than associated release
        endDate: new Date(new Date().valueOf() + 2 * oneWeek).toDateString(), // can't be later than associated release
        stories: [], // array of story IDs
        tasks: [] // array of tasks
      }
    },
    features: {
      'feature-0': {
        id: 'feature-0',
        name: 'Feature Management',
        description: 'Our project will feature the management of features',
        stories: ['story-0'], // array of associated story IDs
        tasks: ['task-0', 'task-2'] // array of associated task IDs (not associated with stories)
      },
      'feature-1': {
        id: 'feature-1',
        name: 'Task Management',
        description: 'Our project will feature the management of tasks',
        stories: ['story-1'], // array of associated story IDs
        tasks: [] // array of associated task IDs (not associated with stories)
      },
      'feature-3': {
        id: 'feature-3',
        name: 'Sprint Management',
        description: 'Our project will feature the management of sprints',
        stories: [], // array of associated story IDs
        tasks: [] // array of associated task IDs (not associated with stories)
      }
    },
    stories: {
      'story-0': {
        id: 'story-0',
        status: 'in-progress',
        // progress can be 100%, but doesn't necessarily mean that story is completed
        // for example, didn't generate/assign every task associated with this story
        name: 'Add Feature',
        description: 'Users will be able to add features to our application',
        businessValue: 8,
        // represents urgency/importance to project
        // effort value defined by tasks
        tasks: [] // array of associated task IDs
      },
      'story-1': {
        id: 'story-1',
        status: 'todo',
        // progress can be 100%, but doesn't necessarily mean that story is completed
        // for example, didn't generate/assign every task associated with this story
        name: 'Add Task',
        description: 'Users will be able to add tasks to our application',
        businessValue: 8,
        // represents urgency/importance to project
        // effort value defined by tasks
        tasks: ['task-1'] // array of associated task IDs
      },
      'story-2': {
        id: 'story-2',
        status: 'todo',
        // progress can be 100%, but doesn't necessarily mean that story is completed
        // for example, didn't generate/assign every task associated with this story
        name: 'Add Sprints',
        description: 'Users will be able to add sprints to our application',
        businessValue: 8,
        // represents urgency/importance to project
        // effort value defined by tasks
        tasks: [] // array of associated task IDs
      }
    },
    tasks: {
      'task-0': {
        id: 'task-0',
        status: 'todo',
        name: 'Create UI for adding features',
        description: 'See title',
        points: 5,
        takenBy: [] // array of member IDs
      },
      'task-1': {
        id: 'task-1',
        status: 'todo',
        name: 'Create UI for adding tasks',
        description: 'See title',
        points: 5,
        takenBy: [] // array of member IDs
      },
      'task-2': {
        id: 'task-2',
        status: 'in-progress',
        name: 'Generate more tasks for stories',
        description: 'We need more tasks',
        points: 8,
        takenBy: ['member-1']
      },
      'task-3': {
        id: 'task-3',
        status: 'done',
        name: 'create tasks 0 and 1',
        description: 'create tasks for adding UI to features and tasks',
        points: 3,
        takenBy: ['member-0']
      },
      'task-4': {
        id: 'task-4',
        status: 'todo',
        name: 'Check for bugs when adding stuff',
        description: 'check for bugs when adding things like releases and tasks',
        points: 10,
        takenBy: []
      }
    },
    pointHistory: {},
    auditLog: [
      {
        date: new Date(currentDate.valueOf() - oneWeek + oneDay).toGMTString(),
        members: ['member-0', 'member-1'], // array of member IDs involved in logged action
        description: '<b>Big Jeffrey</b> added <b>Little Wendy</b> as a <b>Product Owner</b>' // probably generated server side based on what's changed
      },
      {
        date: new Date(currentDate.valueOf() - oneWeek).toGMTString(),
        members: ['member-0'], // array of member IDs involved in logged action
        description: 'Project Created by <b>Big Jeffrey</b>' // probably generated server side based on what's changed
      }
    ],
    defaultSprintLength: 14
  };
  
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

  await taskCommand.add(member);

  let searchResult = await taskCommand.find({ id: member.id });
  expect(searchResult.length).toBe(1);
  // expect result to be equal to inserted member
  Object.keys(member).forEach(key => {
    expect(searchResult[0][key]).toEqual(member[key]);
  });

  const deleteResult = await taskCommand.delete({ id: member.id });
  expect(deleteResult).toBeTruthy();
  expect(deleteResult.result).toBeDefined();
  expect(deleteResult.result.n).toEqual(1);
  expect(deleteResult.result.ok).toEqual(1);

  searchResult = await taskCommand.find({ id: member.id });
  expect(searchResult.length).toBe(0);
});
