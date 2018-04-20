const MongoConnector = require('../MongoConnector');
const MemberCommand = require('./member');
const ProjectCommand = require('./project');

class ColiberateModule {
  constructor (url = '', dbName = 'coliberate') {
    this._connector = new MongoConnector(url, dbName);
    this.members = new MemberCommand(this._connector);
    this.projects = new ProjectCommand(this._connector);
  }

  closeConnection() {
    return this._connector.closeConnection();
  }
}

module.exports = ColiberateModule;
