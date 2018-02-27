const express = require('express'),
  app = express(),
  bodyParser = require('body-parser');


const argv = require('yargs')
  .usage('Usage: $0 -p [integer] -i [string of IP address] -f [directory to build or dist folder] -d')
  .default("p", 80)
    .alias('p', 'port')
    .describe('p', 'Port to run server on')
  .default("i", '127.0.0.1')
    .alias('i', 'ip').alias('i', 'ip-address')
    .describe('i', 'IP Address to run server on')
  .default("f", `${__dirname}/public`)
    .alias('f','build-folder').alias('f', 'dist-folder')
    .describe('f', 'Directory to use as the public root folder (i.e. accessible via URL). Must be an absolute path that doesn\'t end with a slash')
  .default('d', false)
    .alias('d', 'dev')
    .describe('d', 'Populate database with dummy information for development')
  .help('h').alias('h', 'help')
  .argv;

const dbWrapper = require('./modules/ColiberateDbWrapper');
const url = 'mongodb://localhost:27017';
const db = new dbWrapper(url, argv.dev ? 'coliberate-dev' : 'coliberate');

// files in public folder can be accessed via URL
app.use(express.static(argv['build-folder']));

app.use(bodyParser.json()); // support JSON-encoded bodies
app.use(bodyParser.urlencoded({ extended: true})); // support URL-encoded bodies

if (argv.dev) {
  app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });
}

// any url not starting with /api
app.get(/^(?!\/api).*$/, (req, res) => {
  res.sendFile(`./index.html`, { root: argv['build-folder'] });
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
    // accountData.id = +accountData.id;
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

app.post('/api/register', memberRegisterHandler)

app.post('/api/login', async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  console.log("/api/login: Received", { username, password });

  if (!username || !password) {
    res.status(403).send({ error: 'Login fields must be filled' });
    return;
  }

  const query = { username, password };
  const member = await db.findMember(query);

  console.log("/api/login: member login", member);

  if (member.length === 1) {
    const data = {};
    // omit password field if necessary
    if (member[0].password) {
      Object.keys(member[0]).forEach(f => {
        if (f !== 'password') {
          data[f] = member[0][f];
        }
      })
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

    // if (memberID) {
    //   query.id = +memberID;
    // }

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
      console.log({ memberID })
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
  console.log("Populating database with sample data");
  const sampleMembers = [
    {
      id: '1',
      name: 'John Smith',
      email: 'johnsmith@company.com',
      password: 'password',
      username: 'johnsmith@company.com'
    },
    {
      id: '2',
      name: 'Jane Doe',
      email: 'developer1@company.com',
      password: 'password',
      username: 'developer1@company.com'
    },
    {
      id: '3',
      name: 'Generic Developer #1',
      email: 'developer_1@company.com',
      password: 'password',
      username: 'developer_1@company.com'
    }
  ];

  const sampleProjects = [
    {
      id: 'TestProject1',
      name: 'Test Project #1',
      description: 'Description for Test Project #1',
      members: [
        {
          memberID: '1',
          role: 'Scrum Master'
        },
        {
          memberID: '2',
          role: 'Developer'
        },
      ],
      releases: [],
      sprints: [],
      tasks: [],
      startdate: new Date().toUTCString()
    },
    {
      id: 'TestProject2',
      name: 'Test Project #2',
      description: 'Test Project #2 Description',
      members: [
        {
          memberID: '2',
          role: 'Scrum Master'
        },
        {
          memberID: '3',
          role: 'Product Owner'
        },
      ],
      releases: [],
      sprints: [],
      tasks: [],
      startdate: new Date().toUTCString()
    }
  ];

  // ensure that tables are empty
  try {
    await db.dropCollectionInDB('members');
  } catch (err) { }

  try {
    await db.dropCollectionInDB('projects');
  } catch (err) { }

  const memberPopulationPromises = sampleMembers.map(m => db.addMember(m));
  const projectPopulationPromises = sampleProjects.map(p => db.addProject(p));

  await Promise.all([...memberPopulationPromises, ...projectPopulationPromises]);

  console.log("Finished populating database with sample data");
}
