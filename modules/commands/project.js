const MongoCommand = require('../MongoCommand');
const MongoConnector = require('../MongoConnector');

class ProjectCommand extends MongoCommand {
  constructor(connector = new MongoConnector()) {
    super(connector, 'projects');
  }

  getInvalidFieldsFor(project) {
    const expectedFields = ['id', 'name', 'description', 'members', 'releases', 'sprints', 'features', 'stories', 'tasks', 'pointHistory', 'auditLog', 'defaultSprintLength'];
    if (typeof project !== 'object') {
      return expectedFields;
    }

    // TODO: provide better validation
    const invalidFields = expectedFields.filter(f => !project[f]);
    return invalidFields;
  }

  async update(project) {
    await this.add(project);
  }
}

module.exports = ProjectCommand;
