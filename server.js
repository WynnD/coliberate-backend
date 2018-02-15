const express = require('express'),
  app = express();

const argv = require('yargs')
  .usage('Usage: $0 -p [integer] -i [string of IP address] -f [directory to build or dist folder]')
  .default("p", 80)
  .default("i", '127.0.0.1')
  .default("f", `${__dirname}/public`)
  .alias('p', 'port')
  .alias('i', 'ip').alias('i', 'ip-address')
  .alias('f','build-folder').alias('f', 'dist-folder')
  .describe('p', 'Port to run server on')
  .describe('i', 'IP Address to run server on')
  .describe('f', 'Directory to use as the public root folder (i.e. accessible via URL). Must be an absolute path that doesn\'t end with a slash')
  .help('h').alias('h', 'help')
  .argv;

// files in public folder can be accessed via URL
app.use(express.static(argv['build-folder']));

app.get('/', (req, res) => {
  res.sendFile(`./index.html`, { root: argv['build-folder'] });
});

app.get('/data', (req, res) => {
  res.send({ error: 'Data as a JSON object should be returned here' });
});

let server;
if (argv.ip !== '127.0.0.1') {
  server = app.listen(argv.port, argv.ip, onServerReady);
} else {
  server = app.listen(argv.port, onServerReady);
}

function onServerReady() {
  console.info(`Using ${argv['build-folder']} as public root folder`);
  console.info("Listening on " + this.address().address + ":" + this.address().port);
}
