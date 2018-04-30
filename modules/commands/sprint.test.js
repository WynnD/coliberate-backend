// outputs any remaining connections every 30 seconds, if any
require('leaked-handles').set({
  fullStack: true, // use full stack traces
  timeout: 30000, // run every 30 seconds instead of 5.
  debugSockets: true // pretty print tcp thrown exceptions.
});

const { sampleProject, sampleSprint } = require('../utils');

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

test('add sprint to project with no associations', async () => {
  await cw.projects.add(sampleProject);
  await cw.projects.sprints.add(sampleProject.id, sampleSprint);

  const projects = await cw.projects.find({ id: sampleProject.id });
  const project = projects[0];

  const filteredSprints = Object.values(project.sprints).filter(sprint => sprint.id === sampleSprint.id);
  expect(filteredSprints.length).toBe(1);
});

test('add sprint to project with release association', async () => {
  const targetRelease = 'release-1';
  const originalProjects = await cw.projects.find({ id: sampleProject.id });
  const originalProject = originalProjects[0];
  const originalLength = originalProject.releases[targetRelease].sprints.length;
  await cw.projects.sprints.add(sampleProject.id, sampleSprint, targetRelease);

  const projects = await cw.projects.find({ id: sampleProject.id });
  const project = projects[0];
  const release = project.releases[targetRelease];
  const associatedSprints = release.sprints;
  const filteredSprints = associatedSprints.filter(sprintId => sprintId === sampleSprint.id);
  expect(associatedSprints.length).toEqual(originalLength + 1);
  expect(filteredSprints.length).toEqual(1);
});


test('remove sprint with all associations', async () => {
  expect.assertions(1
    + Object.values(sampleProject.releases).length);

  await cw.projects.sprints.delete(sampleProject.id, sampleSprint.id);
  const projects = await cw.projects.find({ id: sampleProject.id });
  const project = projects[0];

  const sprints = Object.values(project.sprints).map(s => s.id);
  expect(sprints.indexOf(sampleSprint.id)).toBe(-1);

  const hasSprintAssociation = (item, id) => item.sprints.indexOf(id) > -1;
  for (const release of Object.values(project.releases)) {
    const hasAssociation = hasSprintAssociation(release, sampleSprint.id);
    expect(hasAssociation).toBeFalsy();
  }
});
