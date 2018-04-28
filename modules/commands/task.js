const ProjectCommand = require('./project');
const MongoCommand = require('../MongoCommand');

class TaskCommand extends MongoCommand {
  constructor(projectCommand = new ProjectCommand()) {
    super(projectCommand._manager._connector);
    this._projectCommand = projectCommand;
  }

  // eslint-disable-next-line no-unused-vars
  getInvalidFieldsFor(task, projectId) {
    const expectedFields = ['id', 'name', 'takenBy', 'status'];
    if (typeof task !== 'object') {
      return expectedFields;
    }

    var invalidFields = expectedFields.filter(f => !task[f]);
    /*if (task.hasOwnProperty('members')) {
      if (getInvalidMemberForProject(task['member'].length !== 0))
        invalidFields.push('members');
    }*/
    return invalidFields;
  }

  isValid(task, projectId) {
    return this.getInvalidFieldsFor(task, projectId).length === 0;
  }

  async add(projectId, task, associatedFeatures = [], associatedSprints = [], associatedStories = []) {
    if (!this.isValid(task, projectId)) {
      const missingFields = this.getInvalidFieldsFor(task);
      const errorMessage = `Invalid Fields: ${missingFields.join(', ')}`;
      throw Error(errorMessage);
    }
    await this._projectCommand.updateInternalField({ id: projectId }, (project) => {
      project.tasks[task.id] = task;
      return { tasks: project.tasks };
    });

    if (associatedFeatures.length > 0 || associatedSprints.length > 0 || associatedStories.length > 0) {
      // assumption: related fields checked previously with isValid function
      const project = await this._projectCommand.find({ id: projectId });

      for (const id of associatedFeatures) {
        const feature = project[0].features[id];
        feature.tasks.push(task.id);
        // console.log('updating entry for feature', id);
        await this._projectCommand.features.update(projectId, feature);
      }

      for (const id of associatedSprints) {
        const sprint = project[0].sprints[id];
        sprint.tasks.push(task.id);
        // console.log('updating entry for sprint', id);
        await this._projectCommand.sprints.update(projectId, sprint);
      }
      
      for (const id of associatedStories) {
        const story = project[0].stories[id];
        story.tasks.push(task.id);
        // console.log('updating entry for sprint', id);
        await this._projectCommand.stories.update(projectId, story);
      }
    }
  }

  async update(projectId, task) {
    await this.add(projectId, task);
  }

  async delete(projectId, taskId) {
    const projects = await this._projectCommand.find({ id: projectId });
    const project = projects[0];
    const stories = project.stories;
    const features = project.features;
    const sprints = project.sprints;

    for (const story of Object.values(stories)) {
      story.tasks = story.tasks.filter((elem) => elem !== taskId);
      await this._projectCommand.stories.update(projectId, story);
    }

    for (const feature of Object.values(features)) {
      feature.tasks = feature.tasks.filter((elem) => elem !== taskId);
      await this._projectCommand.features.update(projectId, feature);
    }

    for (const sprint of Object.values(sprints)) {
      sprint.tasks = sprint.tasks.filter((elem) => elem !== taskId);
      await this._projectCommand.sprints.update(projectId, sprint);
    }
    
    return await this._projectCommand.updateInternalField({ id: projectId }, (project) => {
      delete project.tasks[taskId];
      return { tasks: project.tasks };
    });
  }
}

module.exports = TaskCommand;
