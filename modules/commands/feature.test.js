// outputs any remaining connections every 30 seconds, if any
require('leaked-handles').set({
  fullStack: true, // use full stack traces
  timeout: 30000, // run every 30 seconds instead of 5.
  debugSockets: true // pretty print tcp thrown exceptions.
});

const sampleProject = require('../utils').sampleProject;
const sampleFeature = require('../utils').sampleFeature;

const ColiberateWrapper = require('./coliberate-module');
const url = 'mongodb://localhost:27017';
const cw = new ColiberateWrapper(url, 'coliberate');

function hasTaskAssociation(obj, taskId) {
  const index = obj.tasks.indexOf(taskId);
  return index >= 0;
}

async function emptyDatabase() {
  /* eslint-disable no-empty */
  try {
    await cw.members.drop();
  } catch (err) { }

  try {
    await cw.projects.drop();
  } catch (err) { }
  /* eslint-enable no-empty */
}

afterAll(async () => {
  await emptyDatabase();
  await cw.closeConnection();
});

test('add feature to project with no associations', async () => {
  await cw.projects.add(sampleProject);
  await cw.projects.features.add(sampleProject.id, sampleFeature);

  const projects = await cw.projects.find({ id: sampleProject.id });
  const project = projects[0];

  let features = Object.values(project.features);
  features = features.filter((feature) => feature.id === sampleFeature.id);
  expect(features.length).toBe(1);
});

test('delete feature from project with no associations', async () => {
  await cw.projects.features.delete(sampleProject.id, sampleFeature.id);

  const projects = await cw.projects.find({ id: sampleProject.id });
  const project = projects[0];

  let features = Object.values(project.features);
  features = features.filter((feature) => feature.id === sampleFeature.id);
  expect(features.length).toBe(0);
});

test('add feature to project with associations', async () => {  
  let feature = sampleFeature;
  feature.stories.push('story-0');
  feature.tasks.push('task-1');
  await cw.projects.features.add(sampleProject.id, feature, ['release-0']);

  const projects = await cw.projects.find({ id: sampleProject.id });
  const project = projects[0];
  const releases = await cw.projects.releases.find({ id: 'release-0' });
  const release = releases[0];

  let features = Object.values(project.features);
  features = features.filter((feature) => feature.id === sampleFeature.id);
  expect(features.length).toBe(1);
  feature = features[0];
  let stories = feature.stories.filter(e => e === 'story-0');
  let tasks = feature.tasks.filter(e => e === 'task-1');
  expect(stories.length).toBe(1);
  expect(tasks.length).toBe(1);

  let release_features = release.features;
  release_features = release_features.filter(e => e === 'release-0');
  expect(release_features.length).toBe(1);
});

test('remove feature from project with release associations', async () => {

  await cw.projects.features.delete(sampleProject.id, sampleFeature.id);

  const releases = await cw.projects.releases.find({ id: 'release-0' });
  const release = releases[0];

  let features = release.features;
  features = features.filter((feature) => feature.id === sampleFeature.id);
  expect(features.length).toBe(0);
});

/*
test('add feature to project with story association', async () => {
  // this not passing is a stories.update() issue

  await cw.projects.tasks.add(sampleProject.id, sampleTask, [], [], ['story-0']);

  const projects = await cw.projects.find({ id: sampleProject.id });
  const project = projects[0];
  const story = project.stories['story-0'];
  const associatedTasks = story.tasks;
  const task = associatedTasks.filter((task) => task === sampleTask.id);
  expect(task.length).toBe(1);
});

test('add task to project with feature association', async () => {
  // this not passing is a stories.update() issue

  await cw.projects.tasks.add(sampleProject.id, sampleTask, ['feature-0'], [], []);

  const projects = await cw.projects.find({ id: sampleProject.id });
  const project = projects[0];
  const feature = project.features['feature-0'];
  const associatedTasks = feature.tasks;
  const task = associatedTasks.filter((task) => task === sampleTask.id);
  expect(task.length).toBe(1);
});

test('add task to project with sprint association', async () => {
  // this not passing is a stories.update() issue

  await cw.projects.tasks.add(sampleProject.id, sampleTask, [], ['sprint-0'], []);

  const projects = await cw.projects.find({ id: sampleProject.id });
  const project = projects[0];
  const sprint = project.sprints['sprint-0'];
  const associatedTasks = sprint.tasks;
  const task = associatedTasks.filter((task) => task === sampleTask.id);
  expect(task.length).toBe(1);
});

test('remove task from project with all associations', async () => {
  expect.assertions(1
    + Object.values(sampleProject.sprints).length
    + Object.values(sampleProject.stories).length
    + Object.values(sampleProject.features).length);

  await cw.projects.tasks.delete(sampleProject.id, sampleTask.id);

  const projects = await cw.projects.find({ id: sampleProject.id });
  const project = projects[0];

  const tasks = Object.values(project.tasks);
  const containsTask = !tasks.indexOf(sampleTask.id) == -1;
  expect(containsTask).toBeFalsy();

  for (const sprint of Object.values(project.sprints)) {
    const hasAssociation = hasTaskAssociation(sprint, sampleTask.id);
    expect(hasAssociation).toBeFalsy();
  }

  for (const feature of Object.values(project.features)) {
    const hasAssociation = hasTaskAssociation(feature, sampleTask.id);
    expect(hasAssociation).toBeFalsy();
  }

  for (const story of Object.values(project.stories)) {
    const hasAssociation = hasTaskAssociation(story, sampleTask.id);
    expect(hasAssociation).toBeFalsy();
  }
});
*/