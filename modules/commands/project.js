const MongoCommand = require('../MongoCommand');
const MongoConnector = require('../MongoConnector');
const StoryCommand = require('./story');
const FeatureCommand = require('./feature');
const ReleaseCommand = require('./release');
const SprintCommand = require('./sprint');
const TaskCommand = require('./task');

class ProjectCommand extends MongoCommand {
  constructor(connector = new MongoConnector()) {
    super(connector, 'projects');
    this.stories = new StoryCommand(this);
    this.features = new FeatureCommand(this);
    this.releases = new ReleaseCommand(this);
    this.sprints = new SprintCommand(this);
    this.tasks = new TaskCommand(this);
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

  async delete(projectId) {
    return await super.delete({id: projectId});
  }

  async updateInternalField(query = {}, updateFn = () => {}) {
    return await super.update(query, updateFn);
  }
}

module.exports = ProjectCommand;
