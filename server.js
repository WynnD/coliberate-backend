const express = require('express'),
  app = express();

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

const dbWrapper = require('./ColiberateDBWrapper');
const url = 'mongodb://localhost:27017';
const db = new dbWrapper(url, argv.dev ? 'coliberate-dev' : 'coliberate');

// files in public folder can be accessed via URL
app.use(express.static(argv['build-folder']));

app.get('/', (req, res) => {
  res.sendFile(`./index.html`, { root: argv['build-folder'] });
});

app.get('/data', (req, res) => {
  res.send({ error: 'Data as a JSON object should be returned here' });
});

app.get('/projects', async (req, res) => {
  const memberID = req.query.memberid;

  if (memberID === undefined || isNaN(memberID)) {
    res.sendStatus(403).end();
  } else {
    const data = await db.findProject({ members: { $elemMatch: { memberID: +memberID } } });
    res.send(data);
  }
})

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
      id: 1,
      name: 'John Smith',
      email: 'company@company.com',
      password: 'password',
      username: 'company@company.com'
    },
    {
      id: 2,
      name: 'Jane Doe',
      email: 'developer1@company.com',
      password: 'password',
      username: 'developer1@company.com'
    },
    {
      id: 3,
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
          memberID: 1,
          role: 'Scrum Master'
        },
        {
          memberID: 2,
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
          memberID: 2,
          role: 'Scrum Master'
        },
        {
          memberID: 3,
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
