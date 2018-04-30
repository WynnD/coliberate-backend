// outputs any remaining connections every 30 seconds, if any
require('leaked-handles').set({
  fullStack: true, // use full stack traces
  timeout: 30000, // run every 30 seconds instead of 5.
  debugSockets: true // pretty print tcp thrown exceptions.
});


const { sampleProject, sampleStory } = require('../utils');


const ColiberateWrapper = require('./coliberate-module');
const url = 'mongodb://localhost:27017';
const cw = new ColiberateWrapper(url, 'coliberate');

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

beforeAll(async () => {
  await emptyDatabase();
})

afterAll(async () => {
  await emptyDatabase();
  await cw.closeConnection();
});

test('add story to project with no associations', async () => {
  await cw.projects.add(sampleProject);
  await cw.projects.stories.add(sampleProject.id, sampleStory);

  const projects = await cw.projects.find({ id: sampleProject.id });
  const project = projects[0];

  const filteredStories = Object.values(project.stories).filter(story => story.id === sampleStory.id);
  expect(filteredStories.length).toBe(1);
});

test('add story to project with feature association', async () => {
  const targetFeature = 'feature-0';
  const originalProjects = await cw.projects.find({ id: sampleProject.id });
  const originalProject = originalProjects[0];
  const originalLength = originalProject.features[targetFeature].stories.length;
  await cw.projects.stories.add(sampleProject.id, sampleStory, [targetFeature]);

  const projects = await cw.projects.find({ id: sampleProject.id });
  const project = projects[0];
  const feature = project.features[targetFeature];
  const associatedStories = feature.stories;
  const filteredStories = associatedStories.filter(storyId => storyId === sampleStory.id);
  expect(associatedStories.length).toEqual(originalLength + 1);
  expect(filteredStories.length).toEqual(1);
});

test('add story to project with sprint association', async () => {
  const targetSprint = 'sprint-0';
  const originalProjects = await cw.projects.find({ id: sampleProject.id });
  const originalProject = originalProjects[0];
  const originalLength = originalProject.sprints[targetSprint].stories.length;
  await cw.projects.stories.add(sampleProject.id, sampleStory, [], [targetSprint]);

  const projects = await cw.projects.find({ id: sampleProject.id });
  const project = projects[0];
  const sprint = project.sprints[targetSprint];
  const associatedStories = sprint.stories;
  const filteredStories = associatedStories.filter(storyId => storyId === sampleStory.id);
  expect(associatedStories.length).toEqual(originalLength + 1);
  expect(filteredStories.length).toEqual(1);
});

test('remove story with all associations', async () => {
  expect.assertions(1
    + Object.values(sampleProject.sprints).length
    + Object.values(sampleProject.features).length);

  await cw.projects.stories.delete(sampleProject.id, sampleStory.id);
  const projects = await cw.projects.find({ id: sampleProject.id });
  const project = projects[0];

  const stories = Object.values(project.stories).map(s => s.id);
  expect(stories.indexOf(sampleStory.id)).toBe(-1);

  const hasStoryAssociation = (item, id) => item.stories.indexOf(id) > -1;
  for (const sprint of Object.values(project.sprints)) {
    const hasAssociation = hasStoryAssociation(sprint, sampleStory.id);
    expect(hasAssociation).toBeFalsy();
  }

  for (const feature of Object.values(project.features)) {
    const hasAssociation = hasStoryAssociation(feature, sampleStory.id);
    expect(hasAssociation).toBeFalsy();
  }
});
