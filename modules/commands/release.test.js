// outputs any remaining connections every 30 seconds, if any
require('leaked-handles').set({
  fullStack: true, // use full stack traces
  timeout: 30000, // run every 30 seconds instead of 5.
  debugSockets: true // pretty print tcp thrown exceptions.
});

const sampleProject = require('../utils').sampleProject;
const sampleRelease = require('../utils').sampleRelease;

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

afterAll(async () => {
  await emptyDatabase();
  await cw.closeConnection();
});

test('add release to project with no associations', async () => {
  await cw.projects.add(sampleProject);
  await cw.projects.releases.add(sampleProject.id, sampleRelease);

  const projects = await cw.projects.find({ id: sampleProject.id });
  const project = projects[0];

  let releases = Object.values(project.releases);
  releases = releases.filter((task) => task.id === sampleRelease.id);
  expect(releases.length).toBe(1);
});

test('remove release from project', async () => {
  await cw.projects.releases.delete(sampleProject.id, sampleRelease.id);

  const projects = await cw.projects.find({ id: sampleProject.id });
  const project = projects[0];

  let releases = Object.values(project.releases);
  releases = releases.filter(e => e.id === sampleRelease.id);
  expect(releases.length).toBe(0);
});
