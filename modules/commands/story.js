const ProjectCommand = require('./project');
const MongoCommand = require('../MongoCommand');

class StoryCommand extends MongoCommand {
  constructor(projectCommand = new ProjectCommand()) {
    super(projectCommand._manager._connector);
    this._projectCommand = projectCommand;
  }

  // eslint-disable-next-line no-unused-vars
  getInvalidFieldsFor(story = {}, projectId) {
    const expectedFields = ['id', 'name', 'tasks'];
    if (typeof story !== 'object') {
      return expectedFields;
    }

    const invalidFields = expectedFields.filter(f => !story[f]);
    return invalidFields;
  }

  isValid(story, projectId) {
    return this.getInvalidFieldsFor(story, projectId).length === 0;
  }

  async add(projectId, story = {}, associatedFeatures = [], associatedSprints = []) {
    if (!this.isValid(story, projectId)) {
      const missingFields = this.getInvalidFieldsFor(story);
      const errorMessage = `Invalid Fields: ${missingFields.join(', ')}`;
      throw Error(errorMessage);
    }

    await this._projectCommand.updateInternalField({ id: projectId }, (project) => {
      project.stories[story.id] = story;
      return { stories: project.stories };
    });

    if (associatedFeatures.length > 0 || associatedSprints.length > 0) {
      // assumption: related fields checked previously with isValid function
      const project = await this._projectCommand.find({ id: projectId });
      for (const id of associatedFeatures) {
        const feature = project[0].features[id];
        feature.stories.push(story.id);
        await this._projectCommand.features.update(projectId, feature);
      }
  
      for (const id of associatedSprints) {
        const sprint = project[0].sprints[id];
        sprint.stories.push(story.id);
        await this._projectCommand.sprints.update(projectId, sprint);
      }
    }
  }

  async update(projectId, story) {
    await this.add(projectId, story);
  }

  async delete(projectId, storyId) {
    // eslint-disable-next-line no-console
    console.log('TODO: update anything related to this story');
    return await this._projectCommand.updateInternalField({ id: projectId }, (project) => {
      delete project.stories[storyId];
      return { stories: project.stories };
    });
  }
}

module.exports = StoryCommand;
