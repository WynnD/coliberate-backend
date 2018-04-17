const ProjectCommand = require('./project');
const MongoCommand = require('../MongoCommand');

class ReleaseCommand extends MongoCommand {
  constructor(projectCommand = new ProjectCommand()) {
    super(projectCommand._manager._connector);
    this._projectCommand = projectCommand;
  }

  // eslint-disable-next-line no-unused-vars
  getInvalidFieldsFor(release, projectId) {
    const expectedFields = ['id', 'name', 'description', 'startDate', 'endDate', 'sprints', 'features'];
    if (typeof release !== 'object') {
      return expectedFields;
    }

    // TODO: provide better validation, especially with using projectId
    const invalidFields = expectedFields.filter(f => !release[f]);
    return invalidFields;
  }

  async add(projectId, release = {}) {
    if (!this.isValid(release)) {
      const missingFields = this.getInvalidFieldsFor(release);
      const errorMessage = `Invalid Fields: ${missingFields.join(', ')}`;
      throw Error(errorMessage);
    }

    return await this._projectCommand.updateInternalField({ id: projectId }, (project) => {
      project.releases[release.id] = release;
      return { releases: project.releases };
    });
  }

  async update(projectId, release) {
    return await this.add(projectId, release);
  }

  async delete(projectId, releaseId) {
    // eslint-disable-next-line no-console
    console.log('TODO: update anything related to this release');
    return await this._projectCommand.updateInternalField({ id: projectId }, (project) => {
      delete project.releases[releaseId];
      return { releases: project.releases };
    });
  }
}

module.exports = ReleaseCommand;
