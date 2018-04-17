const ProjectCommand = require('./project');
const MongoCommand = require('../MongoCommand');

class FeatureCommand extends MongoCommand {
  constructor(projectCommand = new ProjectCommand()) {
    super(projectCommand._manager._connector);
    this._projectCommand = projectCommand;
  }

  // eslint-disable-next-line no-unused-vars
  getInvalidFieldsFor(featureData, projectId) {
    const expectedFields = ['id', 'name', 'description', 'stories', 'tasks'];
    if (typeof featureData !== 'object') {
      return expectedFields;
    }

    const invalidFields = expectedFields.filter(f => !featureData[f]);
    return invalidFields;
  }

  isValid(featureData, projectId) {
    return this.getInvalidFieldsFor(featureData, projectId).length === 0;
  }

  async add(projectId, feature = {}, associatedReleases = []) {
    if (!this.isValid(feature, projectId)) {
      const missingFields = this.getInvalidFieldsFor(feature);
      const errorMessage = `Invalid Fields: ${missingFields.join(', ')}`;
      throw Error(errorMessage);
    }

    await this._projectCommand.updateInternalField({ id: projectId }, (project) => {
      project.features[feature.id] = feature;
      return { features: project.features };
    });

    if (associatedReleases.length > 0) {
      // assumption: related fields checked previously with isValid function
      const project = await this._projectCommand.find({ id: projectId });
  
      associatedReleases.forEach(async (id) => {
        const release = project[0].releases[id];
        release.features.push(feature.id);
        await this.updateRelease(projectId, release);
      });
    }
  }

  async update(projectId, feature) {
    return await this.add(projectId, feature);
  }

  async delete(projectId, featureId) {
    // eslint-disable-next-line no-console
    console.log('TODO: update anything related to this feature');
    await this._projectCommand.updateInternalField({ id: projectId }, (project) => {
      delete project.features[featureId];
      return { features: project.features };
    });

    const project = await this._projectCommand.find({ id: projectId });
    const releases = project[0].releases;
    Object.keys(releases).forEach((key) => {
      const featureIndex = releases[key].features.indexOf(featureId);
      if (featureIndex !== -1) {
        releases[key].features.splice(featureIndex, 1);
      }
    });

    return await this._projectCommand.updateInternalField({ id: projectId }, () => {
      return { releases };
    });
  }
}

module.exports = FeatureCommand;
