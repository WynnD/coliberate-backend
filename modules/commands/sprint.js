const ProjectCommand = require('./project');
const MongoCommand = require('../MongoCommand');

class SprintCommand extends MongoCommand {
  constructor(projectCommand = new ProjectCommand()) {
    super(projectCommand._manager._connector);
    this._projectCommand = projectCommand;
  }

  // eslint-disable-next-line no-unused-vars
  getInvalidFieldsFor(sprint, projectId, associatedReleaseId) {
    const expectedFields = ['id', 'name', 'startDate', 'endDate', 'stories', 'tasks'];
    if (typeof sprint !== 'object') {
      return expectedFields;
    }

    // TODO: provide better validation, especially with using projectId
    const invalidFields = expectedFields.filter(f => !sprint[f]);
    return invalidFields;
  }

  isValid(sprint, projectId, associatedReleaseId) {
    return this.getInvalidFieldsFor(sprint, projectId, associatedReleaseId).length === 0;
  }

  async add(projectId, sprint = {}, associatedReleaseId = '') {
    if (!this.isValid(sprint, projectId, associatedReleaseId)) {
      const missingFields = this.getInvalidFieldsFor(sprint);
      const errorMessage = `Invalid Fields: ${missingFields.join(', ')}`;
      throw Error(errorMessage);
    }

    await this._projectCommand.updateInternalField({ id: projectId }, (project) => {
      project.sprints[sprint.id] = sprint;
      return { sprints: project.sprints };
    });

    if (associatedReleaseId) {
      // assumption: existence of related fields checked previously with isValid function
      // const project = await this.findProject({ id: projectId });
      const project = await this._projectCommand.find({ id: projectId });
      const release = project[0].releases[associatedReleaseId];
      release.sprints.push(sprint.id);
      // return await this.updateRelease(projectId, release);
      await this._projectCommand.releases.update(projectId, release);
    }
  }

  async update(projectId, sprint) {
    return await this.add(projectId, sprint);
  }

  async delete(projectId, sprintId) {
    // eslint-disable-next-line no-console
    console.log('TODO: update anything related to this sprint');
    await this._projectCommand.updateInternalField({ id: projectId }, (project) => {
      delete project.sprints[sprintId];
      return { sprints: project.sprints };
    });
  }
}

module.exports = SprintCommand;
