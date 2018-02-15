const express = require('express'),
  app = express();

const argv = require('yargs')
  .usage('Usage: $0 -p [integer] -i [string of IP address]')
  .default("p", 80)
  .default("i", '127.0.0.1')
  .alias('p', 'port')
  .alias('i', 'ip').alias('i', 'ip-address')
  .describe('p', 'Port to run server on')
  .describe('i', 'IP Address to run server on')
  .help('h')
  .alias('h', 'help')
  .argv;

// files in public folder can be accessed via URL
app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
  res.sendFile('public/index.html');
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
  console.info("Listening on " + this.address().address + ":" + this.address().port);
}
