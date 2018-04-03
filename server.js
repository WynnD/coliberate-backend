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

  console.log('memberRegisterHandler: Received', { accountData });

  if (!db.isValidMember(accountData)) {
    res.status(400).send({ error: 'Invalid fields' });
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

    if (memberID === undefined || isNaN(memberID)) {
      res.status(403).send({ error: 'No member ID specified' });
    } else {
      console.log({ memberID });
      const query = { members: { $elemMatch: { memberID: memberID } } };
      if (projectID) {
        query.id = projectID;
      }
      const data = await db.findProject(query);
      res.status(200).send(data);
    }
  }).post(async (req, res) => {
    const projectData = req.body.projectData;

    const expectedEmptyFields = ['releases', 'sprints', 'tasks'];
    expectedEmptyFields.forEach(f => {
      if (!projectData[f]) {
        projectData[f] = [];
      }
    });

    console.log('projectRegisterHandler: Received', { projectData }, projectData.members);

    if (!db.isValidProject(projectData)) {
      res.status(400).send({ error: 'Invalid fields' });
    } else {
      // check if member ID and/or login exists
      const idSearch = await db.findProject({ id: projectData.id });

      if (idSearch.length > 0) {
        // TODO: Add better handling for ID clashing
        console.log({ idSearch });
        res.status(400).send({ error: 'ID already exists. Try again under a different name.' });
      } else {
        await db.addProject(projectData);
        const data = await db.findProject({ id: projectData.id });
        if (data.length === 1) {
          res.status(200).send({
            status: 200,
            data: data[0]
          });
        } else {
          res.status(500).send({ error: 'Array length > 0' });
        }
      }
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
        },{
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
        'member-id1': {
          id: 'member-id1',
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
          startDate: 'date-string',
          endDate: 'date-string',
          // format of start/end date doesn't matter as long as new Date() can parse it
          // startDate < endDate
          features: [], // array of feature IDs
          sprints: [] // array of sprint IDs
        }
      },
      sprints: {
        'sprint1-41245': {
          // goals are defined by associated tasks and stories
          id: 'sprint1-41245',
          name: 'Sprint 1',
          startDate: 'date-string', // can't be earlier than associated release
          endDate: 'date-string',  // can't be later than associated release
          stories: [], // array of story IDs
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
          tasks: [] // array of associated task IDs
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
      },
      auditLog: 'auditLog-id',
      pointHistory: 'pointHistory-id',
      defaultSprintLength: 14
    }, // end project object
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
