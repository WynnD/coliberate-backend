const express = require('express'),
  app = express(),
  bodyParser = require('body-parser');


/* eslint-disable indent,no-console */
const argv = require('yargs')
  .usage('Usage: $0 -p [integer] -i [string of IP address] -f [directory to build or dist folder] -d')
  .default('p', 80)
    .alias('p', 'port')
    .describe('p', 'Port to run server on')
  .default('i', '127.0.0.1')
    .alias('i', 'ip').alias('i', 'ip-address')
    .describe('i', 'IP Address to run server on')
  .default('f', `${__dirname}/public`)
    .alias('f','build-folder').alias('f', 'dist-folder')
    .describe('f', 'Directory to use as the public root folder (i.e. accessible via URL). Must be an absolute path that doesn\'t end with a slash')
  .default('d', false)
    .alias('d', 'dev')
    .describe('d', 'Populate database with dummy information for development')
  .help('h').alias('h', 'help')
  .argv;
/* eslint-enable indent */

const dbWrapper = require('./modules/ColiberateDbWrapper');
const url = 'mongodb://localhost:27017';
const db = new dbWrapper(url, argv.dev ? 'coliberate-dev' : 'coliberate');

// files in public folder can be accessed via URL
app.use(express.static(argv['build-folder']));

app.use(bodyParser.json()); // support JSON-encoded bodies
app.use(bodyParser.urlencoded({ extended: true})); // support URL-encoded bodies

if (argv.dev) {
  app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });
}

// any url not starting with /api
app.get(/^(?!\/api).*$/, (req, res) => {
  res.sendFile('./index.html', { root: argv['build-folder'] });
});

app.get('/data', (req, res) => {
  res.send({ error: 'Data as a JSON object should be returned here' });
});

async function memberRegisterHandler(req, res) {
  const accountData = req.body.accountData;

  if (!accountData.description) {
    accountData.description = 'No description available';
  }

  if (!accountData.skills) {
    accountData.skills = [];
  }

  console.log('memberRegisterHandler: Received', { accountData });

  if (!db.isValidMember(accountData)) {
    const missingFields = db.getInvalidFieldsForMember(accountData);
    const errorMessage = `Invalid Fields: ${missingFields.join(',')}`;
    res.status(400).send({ error: errorMessage });
  } else {
    // check if member ID and/or login exists
    const idSearch = await db.findMember({ id: accountData.id });
    const usernameSearch = await db.findMember({ username: accountData.username });

    if (usernameSearch.length > 0) {
      console.log({ usernameSearch });
      res.status(400).send({ error: 'Login already exists' });
    } else if (idSearch.length > 0) {
      // TODO: Add better handling for ID clashing
      console.log({ idSearch });
      res.status(400).send({ error: 'ID already exists. Refresh and try again.' });
    } else {
      await db.addMember(accountData);
      const data = await db.findMember({ id: accountData.id });
      if (data.length === 1) {
        delete data[0].password;
        res.status(200).send({
          status: 200,
          data: data[0]
        });
      } else {
        res.status(500).send({ error: 'Array length > 0' });
      }
    }
  }
}

async function getProjectsForMember(memberID, projectID) {
  const query = {};
  // query[`members.${memberID}.id`] = memberID;
  query[`members.${memberID}`] = { $exists: true };
  if (projectID) {
    query.id = projectID;
  }
  // console.log(query);
  const data = await db.findProject(query);
  return data;
}

app.post('/api/register', memberRegisterHandler);

app.post('/api/login', async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  console.log('/api/login: Received', { username, password });

  if (!username || !password) {
    res.status(403).send({ error: 'Login fields must be filled' });
    return;
  }

  const query = { username, password };
  const member = await db.findMember(query);

  console.log('/api/login: member login', member);

  if (member.length === 1) {
    let data = {};
    // omit password field if necessary
    if (member[0].password) {
      Object.keys(member[0]).forEach(f => {
        if (f !== 'password') {
          data[f] = member[0][f];
        }
      });
    } else {
      data = member[0];
    }
    res.status(200).send({
      status: 200,
      data
    });
  } else {
    res.status(403).send({ error: 'Invalid login' });
  }
});

// get list of members
// TODO: only get if member of member list? -> parameter via URL
app.route('/api/members/:id?')
  .get(async (req, res) => {
    const memberID = req.params.id;

    const query = {};

    if (memberID) {
      query.id = memberID;
    }

    let data = await db.findMember(query);

    res.status(200).send({
      status: 200,
      data: data.map(d => { delete d.password; return d; })
    });
  })
  .post(memberRegisterHandler);

// get list of projects based on member id
// ex: http://127.0.0.1/projects/?member_id=3
// TODO: use app.route() for CRUD operations - https://expressjs.com/en/guide/routing.html
app.route('/api/projects/:id?')
  .get(async (req, res) => {
    const memberID = req.query.member_id;
    const projectID = req.params.id;

    if (memberID === undefined) {
      res.status(403).send({ error: 'No member ID specified' });
    } else {
      const data = await getProjectsForMember(memberID, projectID);
      if (projectID) {
        if (data[0]) {
          res.status(200).send(data[0]);
        } else {
          res.status(404).send({ error: 'Project not found' });
        }
      } else {
        res.status(200).send(data);
      }
    }
  }).post(async (req, res) => {
    const projectData = req.body.projectData;
    const memberId = req.body.member_id;
    const expectedEmptyArrays = ['pointHistory', 'auditLog'];
    const expectedEmptyObjects = ['releases', 'sprints', 'tasks', 'features', 'stories'];
    expectedEmptyArrays.forEach(f => {
      if (!projectData[f]) {
        projectData[f] = [];
      }
    });

    expectedEmptyObjects.forEach(f => {
      if (!projectData[f]) {
        projectData[f] = {};
      }
    });

    console.log('projectRegisterHandler: Received', { projectData, memberId }, projectData.members);

    if (!db.isValidProject(projectData)) {
      const missingFields = db.getInvalidFieldsForProject(projectData);
      const errorMessage = `Invalid Fields: ${missingFields.join(',')}`;
      return res.status(400).send({ error: errorMessage });
    }

    projectData.auditLog.push({
      date: new Date().toGMTString(),
      members: [memberId], // array of member IDs involved in logged action
      description: 'Project Created' // probably generated server side based on what's changed
    });
    
    const idSearch = await db.findProject({ id: projectData.id });

    if (idSearch.length > 0) {
      // TODO: Add better handling for ID clashing
      console.log({ idSearch });
      res.status(400).send({ error: 'ID already exists. Try again under a different name.' });
    } else {
      await db.addProject(projectData);
      // const projects = await db.findProject({ id: projectData.id });
      return res.sendStatus(200);
    }
  });

app.route('/api/projects/:project_id/releases/:release_id?')
  .get(async (req, res) => {
    const memberID = req.query.member_id;
    const projectID = req.params.project_id;
    const releaseID = req.params.release_id;

    console.log({ memberID, projectID, releaseID });

    if (memberID === undefined) {
      res.status(403).send({ error: 'No member ID specified' });
    } else if (projectID === undefined) {
      res.status(403).send({ error: 'No project ID specified' });
    } else {
      const data = await getProjectsForMember(memberID, projectID);
      if (data.length === 0) {
        return res.status(404).send({ error: 'Project not found' });
      } else {
        const releases = data[0].releases;
        if (releaseID !== undefined) {
          if (releases[releaseID]) {
            return res.status(200).send(releases[releaseID]);
          } else {
            return res.status(404).send({ error: 'Release not found' });
          }
        } else {
          return res.status(200).send(releases);
        }
      }
    }
  }).post(async (req, res) => {
    const releaseData = req.body.releaseData;
    const projectID = req.body.projectID;
    const memberID = req.body.memberID;

    const expectedEmptyFields = ['features', 'sprints'];
    expectedEmptyFields.forEach(f => {
      if (!releaseData[f]) {
        releaseData[f] = [];
      }
    });

    console.log('releaseRegisterHandler: Received', { releaseData, projectID, memberID });

    const projectSearch = await getProjectsForMember(memberID, projectID);
    console.log({ projectSearch });
    if (projectSearch.length === 0) {
      res.status(404).send({ error: 'Project not found for given member' });
    } else if (!db.isValidRelease(releaseData, projectID)) {
      const missingFields = db.getInvalidFieldsForRelease(releaseData, projectID);
      const errorMessage = `Invalid Fields: ${missingFields.join(',')}`;
      res.status(400).send({ error: errorMessage });
    } else {
      const projectData = projectSearch[0];
      const projectReleaseData = projectData.releases;
      if (projectReleaseData[releaseData.id]) {
        return res.status(404).send({ error: 'Release ID already exists.' });
      }
      await db.addRelease(projectID, releaseData);
      res.sendStatus(200);
    }
  });

app.route('/api/projects/:project_id/sprints/:sprint_id?')
  .get(async (req, res) => {
    const memberID = req.query.member_id;
    const projectID = req.params.project_id;
    const sprintID = req.params.sprint_id;

    console.log({
      memberID,
      projectID,
      sprintID
    });

    if (memberID === undefined) {
      res.status(403).send({
        error: 'No member ID specified'
      });
    } else if (projectID === undefined) {
      res.status(403).send({
        error: 'No project ID specified'
      });
    } else {
      const data = await getProjectsForMember(memberID, projectID);
      if (data.length === 0) {
        return res.status(404).send({
          error: 'Project not found'
        });
      } else {
        const sprints = data[0].sprints;
        if (sprintID !== undefined) {
          if (sprints[sprintID]) {
            return res.status(200).send(sprints[sprintID]);
          } else {
            return res.status(404).send({
              error: 'Sprint not found'
            });
          }
        } else {
          return res.status(200).send(sprints);
        }
      }
    }
  }).post(async (req, res) => {
    const sprintData = req.body.sprintData;
    const projectID = req.body.projectID;
    const memberID = req.body.memberID;
    const associatedRelease = req.body.associatedRelease;

    const expectedEmptyFields = ['stories', 'tasks'];
    expectedEmptyFields.forEach(f => {
      if (!sprintData[f]) {
        sprintData[f] = [];
      }
    });

    console.log('releaseRegisterHandler: Received', {
      sprintData,
      projectID,
      memberID,
      associatedRelease
    });

    const projectSearch = await getProjectsForMember(memberID, projectID);
    console.log({ projectSearch });
    if (projectSearch.length === 0) {
      res.status(404).send({
        error: 'Project not found for given member'
      });
    } else if (!db.isValidSprint(sprintData, projectID, associatedRelease)) {
      const missingFields = db.getInvalidFieldsForSprint(sprintData, projectID, associatedRelease);
      const errorMessage = `Invalid Fields: ${missingFields.join(',')}`;
      res.status(400).send({ error: errorMessage });
    } else {
      const projectData = projectSearch[0];
      const projectSprintData = projectData.sprints;
      if (projectSprintData[sprintData.id]) {
        return res.status(404).send({
          error: 'Sprint ID already exists.'
        });
      }
      await db.addSprint(projectID, sprintData, associatedRelease);
      res.sendStatus(200);
    }
  });

app.route('/api/projects/:project_id/stories/:story_id?')
  .get(async (req, res) => {
    const memberID = req.query.member_id;
    const projectID = req.params.project_id;
    const storyID = req.params.story_id;

    console.log({
      memberID,
      projectID,
      storyID
    });

    if (memberID === undefined) {
      res.status(403).send({
        error: 'No member ID specified'
      });
    } else if (projectID === undefined) {
      res.status(403).send({
        error: 'No project ID specified'
      });
    } else {
      const data = await getProjectsForMember(memberID, projectID);
      if (data.length === 0) {
        return res.status(404).send({
          error: 'Project not found'
        });
      } else {
        const stories = data[0].stories;
        if (storyID !== undefined) {
          if (stories[storyID]) {
            return res.status(200).send(stories[storyID]);
          } else {
            return res.status(404).send({
              error: 'Story not found'
            });
          }
        } else {
          return res.status(200).send(stories);
        }
      }
    }
  }).post(async (req, res) => {
    const storyData = req.body.storyData;
    const projectID = req.body.projectID;
    const memberID = req.body.memberID;
    const associatedFeatures = req.body.associatedFeatures || [];
    const associatedSprints = req.body.associatedSprints || [];

    if (!storyData.tasks) {
      storyData.tasks = [];
    }

    if (!storyData.status) {
      storyData.status = 'todo';
    }

    console.log('POST stories: Received', {
      storyData,
      projectID,
      memberID,
      associatedFeatures,
      associatedSprints
    });

    const projectSearch = await getProjectsForMember(memberID, projectID);
    console.log({
      projectSearch
    });
    if (projectSearch.length === 0) {
      res.status(404).send({
        error: 'Project not found for given member'
      });
    } else if (!db.isValidStory(storyData, projectID)) {
      const missingFields = db.getInvalidFieldsForStory(storyData, projectID);
      const errorMessage = `Invalid Fields: ${missingFields.join(',')}`;
      res.status(400).send({
        error: errorMessage
      });
    } else {
      const projectData = projectSearch[0];
      const projectStoriesData = projectData.stories;
      if (projectStoriesData[storyData.id]) {
        return res.status(404).send({
          error: 'Story ID already exists.'
        });
      }
      await db.addStory(projectID, storyData, associatedFeatures, associatedSprints);
      res.sendStatus(200);
    }
  });


app.route('/api/projects/:project_id/features/:feature_id?')
  .get(async (req, res) => {
    const memberId = req.query.member_id;
    const projectId = req.params.project_id;
    const featureId = req.params.feature_id;

    let missing_args = [];
    if (memberId === undefined) {
      missing_args.push('memberId');
    }
    if (projectId === undefined) {
      missing_args.push('projectId');
    }

    if (missing_args.length !== 0) {
      const args = missing_args.join(', ');
      const error_message = { error: `No ${args} specified` };
      return res.status(403).send(error_message);
    } else {
      const data = await getProjectsForMember(memberId, projectId);
      if (data.length === 0) {
        return res.status(404).send({ error: 'Feature not found' });
      } else if (data[0].features[featureId] === undefined) {
        return res.status(403).send({ error: 'User not permitted' });
      } else {
        const features = data[0].features;
        if (featureId !== undefined) {
          const single_feature = features[featureId];
          if (single_feature !== undefined) {
            console.log('sending', { memberId, projectId, featureId });
            return res.status(200).send(single_feature);
          } else {
            return res.status(404).send({ error: 'Feature not found' });
          }
        } else {
          return res.sendStatus(200);
        }
      }
    }
  }).post(async (req, res) => {
    const { featureData, associatedReleases, memberID } = req.body;
    const projectID = req.params.project_id;

    const expectedEmptyFields = ['stories', 'tasks'];
    expectedEmptyFields.forEach(f => {
      if (!featureData[f]) {
        featureData[f] = [];
      }
    });

    console.log('recieved', { featureData, associatedReleases, memberID, projectID });
    const projects = await getProjectsForMember(memberID, projectID);
    if (projects.length === 0) {
      return res.status(404).send({ error: `Cannot find project with id '${projectID}' for user ${memberID}`});
    } else if (!db.isValidFeature(featureData, projectID)) {
      const missingFields = db.getInvalidFieldsForFeature(featureData, projectID);
      return res.status(400).send({ error: `Cannot add feature, missing fields: ${missingFields}` });
    } else {
      const projectData = projects[0];
      const projectFeatureData = projectData.features;
      const projectReleaseData = projectData.releases;
      if (projectFeatureData[featureData.id]) {
        return res.status(400).send({ error: `Feature with ID ${featureData.id} already exists` });
      } else if (associatedReleases && !objectContainsKeys(projectReleaseData, associatedReleases)) {
        const missingReleases = getMissingKeys(projectReleaseData, associatedReleases);
        return res.status(400).send({ error: `Cannot add feature, associated releases do not exist: ${missingReleases}` });
      } else {
        await db.addFeature(projectID, featureData, associatedReleases);
        return res.sendStatus(200);
      }
    }
  });

function objectContainsKeys(object, keyArray = []) {
  const missingKeys = getMissingKeys(object, keyArray);
  return missingKeys.length === 0;
}

function getMissingKeys(object, keyArray = []) {
  return keyArray.filter((id) => object[id] === undefined);
}



app.route('/api/projects/:project_id/tasks/:task_id?')
  .get(async (req, res) => {
    const memberID = req.query.member_id;
    const projectID = req.params.project_id;
    const taskID = req.params.task_id;

    console.log({
      memberID,
      projectID,
      taskID
    });

    if (memberID === undefined) {
      res.status(403).send({
        error: 'No member ID specified'
      });
    } else if (projectID === undefined) {
      res.status(403).send({
        error: 'No project ID specified'
      });
    } else {
      const data = await getProjectsForMember(memberID, projectID);
      if (data.length === 0) {
        return res.status(404).send({
          error: 'Project not found'
        });
      } else {
        const tasks = data[0].tasks;
        if (taskID !== undefined) {
          if (tasks[taskID]) {
            return res.status(200).send(tasks[taskID]);
          } else {
            return res.status(404).send({
              error: 'Story not found'
            });
          }
        } else {
          return res.status(200).send(tasks);
        }
      }
    }
  }).post(async (req, res) => {
    const taskData = req.body.taskData;
    const projectID = req.body.projectID;
    const memberID = req.body.memberID;
    const associatedFeatures = req.body.associatedFeatures || [];
    const associatedSprints = req.body.associatedSprints || [];
    const associatedStories = req.body.associatedStories || [];

    if (!taskData.status) {
      taskData.status = 'todo';
    }

    if (!taskData.takenBy) {
      taskData.takenBy = [];
    }

    console.log('POST stories: Received', {
      taskData,
      projectID,
      memberID,
      associatedFeatures,
      associatedSprints,
      associatedStories
    });

    const projectSearch = await getProjectsForMember(memberID, projectID);
    console.log({
      projectSearch
    });
    if (projectSearch.length === 0) {
      res.status(404).send({
        error: 'Project not found for given member'
      });
    } else if (!db.isValidTask(taskData, projectID)) {
      const missingFields = db.getInvalidFieldsForTask(taskData, projectID);
      const errorMessage = `Invalid Fields: ${missingFields.join(',')}`;
      res.status(400).send({
        error: errorMessage
      });
    } else {
      const projectData = projectSearch[0];
      const projectTaskData = projectData.tasks;
      if (projectTaskData[taskData.id]) {
        return res.status(404).send({
          error: 'Task ID already exists.'
        });
      }
      await db.addTask(projectID, taskData, associatedFeatures, associatedSprints, associatedStories);
      res.sendStatus(200);
    }
  });

// eslint-disable-next-line no-unused-vars
let server;
if (argv.ip !== '127.0.0.1') {
  server = app.listen(argv.port, argv.ip, onServerReady);
} else {
  server = app.listen(argv.port, onServerReady);
}

async function onServerReady() {
  console.info(`Using ${argv['build-folder']} as public root folder`);
  console.info('Listening on ' + this.address().address + ':' + this.address().port);
  if (argv.dev) {
    console.info('Development mode enabled');
    await initializeDbDev();
  }
}

async function initializeDbDev() {
  console.log('Populating database with sample data');
  // 1 week in ms = 7 days * 24 hr/day * 60 min/hr * 60 sec/min * 1000 ms/sec
  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  const currentDate = new Date();
  const sampleMembers = {
    'jsmith-12313': {
      id: 'jsmith-12313',
      name: 'John Smith',
      description: 'John Smith\'s description is this sentence',
      email: 'johnsmith@company.com',
      password: 'password',
      username: 'johnsmith@company.com',
      skills: [
        {
          name: 'Perl',
          interested: false,
          experience: 2
        },
        {
          name: 'C++',
          interested: true,
          experience: 0
        }
      ]
    },
    'jdoe-45235': {
      id: 'jdoe-45235',
      name: 'Jane Doe',
      description: 'Jane Doe\'s description is this sentence',
      email: 'developer1@company.com',
      password: 'password',
      username: 'developer1@company.com',
      skills: [
        {
          name: 'Perl',
          interested: true,
          experience: 0
        },
        {
          name: 'C++',
          interested: true,
          experience: 2
        }
      ]
    },
    'gdeveloper-45212': {
      id: '3',
      name: 'Generic Developer #1',
      description: 'Generic Developer #1\'s description is this sentence',
      email: 'developer_1@company.com',
      password: 'password',
      username: 'developer_1@company.com',
      skills: [
        {
          name: 'C',
          interested: true,
          experience: 2
        },
        {
          name: 'Java',
          interested: true,
          experience: 1
        }
      ]
    },
    'member-0': {
      id: 'member-0',
      name: 'Big Jeffrey',
      description: 'I\'m big, and I\'m Jeffrey. Get used to it.',
      email: 'jeffrey@gmail.com',
      username: 'jeffrey@gmail.com',
      password: 'password',
      joinDate: '2018-02-25',
      skills: [
        {
          name: 'Java',
          interested: true, // boolean indicating whether or not the user is interested in learning with this
          experience: 0 // 0 - no experience, 1 - some experience, 2 - high level experience
        }
      ]
    },
    'member-1': {
      id: 'member-1',
      name: 'Little Wendy',
      description: 'I\'m little, and I\'m Wendy. Get used to it.',
      joinDate: '2018-02-26',
      email: 'wendy@gmail.com',
      username: 'wendy@gmail.com',
      password: 'password',
      skills: [
        {
          name: 'C++',
          interested: true, // boolean indicating whether or not the user is interested in learning with this
          experience: 2 // 0 - no experience, 1 - some experience, 2 - high level experience
        }
      ]
    }
  };

  const sampleProjects = {
    'projectid-213123': {
      // auto-generated by mongodb
      id: 'projectid-213123',
      name: 'project name',
      description: 'project description',
      members: {
        // 1+ members must be in collection when adding
        // at least one member must be scrum master or product owner
        'jsmith-12313': {
          id: 'jsmith-12313',
          role: 'Scrum Master/Product Owner/Developer Team'
          // role must be one of these
          // customRoles: [] // to implement later - #SLACK
        }
      },
      releases: {
        'release1': {
          id: 'release1',
          name: 'Release 1',
          description: 'description of release',
          startDate: new Date(currentDate.valueOf() - oneWeek).toDateString(), // e.g. Mon Mar 12 2018
          endDate: new Date(new Date().valueOf() + 3 * oneWeek).toDateString(),
          // format of start/end date doesn't matter as long as new Date() can parse it
          // startDate < endDate
          features: ['feature1-12314'], // array of feature IDs
          sprints: ['sprint1-41245'] // array of sprint IDs
        }
      },
      sprints: {
        'sprint1-41245': {
          // goals are defined by associated tasks and stories
          id: 'sprint1-41245',
          name: 'Sprint 1',
          startDate: new Date(currentDate.valueOf() - oneWeek).toDateString(), // e.g. Mon Mar 12 2018
          endDate: new Date(new Date().valueOf() + oneWeek).toDateString(),
          stories: ['homepage'], // array of story IDs
          tasks: [] // array of tasks
        }
      },
      features: {
        'feature1-12314': {
          id: 'feature1-12314',
          name: 'feature name',
          description: 'feature description',
          stories: ['homepage'], // array of associated story IDs
          tasks: [] // array of associated task IDs (not associated with stories)
        },
      },
      stories: {
        'homepage': {
          id: 'homepage',
          status: 'in-progress',
          // status must be one of these
          // progress can be 100%, but doesn't necessarily mean that story is completed
          // for example, didn't generate/assign every task associated with this story
          name: 'Homepage',
          description: 'That young homepage',
          businessValue: 13,
          // represents urgency/importance to project
          // effort value defined by tasks
          tasks: ['make-header'] // array of associated task IDs
        },
      },
      tasks: {
        'make-header': {
          id: 'make-header',
          status: 'in-progress',
          // status must be one of these
          name: 'Make header',
          description: 'Make that young header',
          points: 3,
          takenBy: [] //array of member IDs
        },
      },
      // auditLog: 'auditLog-id',
      auditLog: [
        {
          date: new Date(currentDate.valueOf() - oneWeek).toGMTString(),
          members: ['jsmith-12313'], // array of member IDs involved in logged action
          description: 'Project Created by <b>John Smith</b>' // probably generated server side based on what's changed
        }
      ],
      pointHistory: 'pointHistory-id',
      defaultSprintLength: 14
    }, // end project object
    'sampleproject-0': {
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
    }
  };

  // ensure that tables are empty
  /* eslint-disable no-empty */
  try {
    await db.dropCollectionInDB('members');
  } catch (err) { }

  try {
    await db.dropCollectionInDB('projects');
  } catch (err) { }
  /* eslint-enable no-empty */

  const memberPopulationPromises = Object.values(sampleMembers).map(m => db.addMember(m));
  const projectPopulationPromises = Object.values(sampleProjects).map(p => db.addProject(p));

  await Promise.all([...memberPopulationPromises, ...projectPopulationPromises]);

  console.log('Finished populating database with sample data');
}
