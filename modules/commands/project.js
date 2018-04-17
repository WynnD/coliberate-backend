const MongoCommand = require('../MongoCommand');
const MongoConnector = require('../MongoConnector');
const StoryCommand = require('./story');
const FeatureCommand = require('./feature');
const ReleaseCommand = require('./release');

class ProjectCommand extends MongoCommand {
  constructor(connector = new MongoConnector()) {
    super(connector, 'projects');
    this.stories = new StoryCommand(this);
    this.features = new FeatureCommand(this);
    this.releases = new ReleaseCommand(this);
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
    return await this.add(project);
  }

  async updateInternalField(query = {}, updateFn = () => {}) {
    return await super.update(query, updateFn);
  }
}

module.exports = ProjectCommand;
