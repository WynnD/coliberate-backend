const mongo = require('mongodb');

class ColiberateDbWrapper {
  constructor(url, dbName = 'coliberate') {
    this.MongoClient = mongo.MongoClient;
    this.url = url;
    this.dbName = dbName;
    this.connectInstance = null;
    this.dbInstance = null;
    // this.collections = {
    //   members: null
    // }
  }

  getConnectionInstance() {
    return new Promise((fulfill, reject) => {
      if (!this.connectInstance) {
        this.MongoClient.connect(this.url, (err, instance) => {
          if (err) {
            reject(err);
          } else {
            this.connectInstance = instance;
            fulfill(this.connectInstance);
          }
        });
      } else {
        fulfill(this.connectInstance);
      }
    });
  }

  getDatabaseInstance() {
    if (!this.dbInstance) {
      return this.getConnectionInstance()
        .then(conInstance => {
          this.dbInstance = conInstance.db(this.dbName);
          return this.dbInstance;
        });
    } else {
      return Promise.resolve(this.dbInstance);
    }
  }

  insertOneIntoDB(collectionName, entity) {
    return new Promise((fulfill, reject) => {
      this.getDatabaseInstance()
        .then(db => {
          db.collection(collectionName).insertOne(entity, (err/*, res*/) => {
            if (err) {
              reject(err);
            } else {
              fulfill();
            }
          });
        }).catch(reject);
    });
  }

  findInDB(collectionName, query = {}, fieldsToExclude = {}) {
    return new Promise((fulfill, reject) => {
      this.getDatabaseInstance()
        .then(db => {
          db.collection(collectionName)
            .find(query, fieldsToExclude)
            .toArray((err, result) => {
              if (err) {
                reject(err);
              } else {
                fulfill(result);
              }
            });
        }).catch(reject);
    });
  }

  deleteInDB(collectionName, query) {
    return new Promise((fulfill, reject) => {
      if (!query) {
        reject(Error('No query defined for dropMember'));
      }
      this.getDatabaseInstance()
        .then(db => {
          db.collection(collectionName)
            .deleteOne(query, (err, result) => {
              if (err) {
                reject(err);
              } else {
                fulfill(result);
              }
            });
        }).catch(reject);
    });
  }

  dropCollectionInDB(collectionName) {
    return new Promise((fulfill, reject) => {
      this.getDatabaseInstance()
        .then(db => {
          db.collection(collectionName)
            .drop((err, delOK) => {
              if (err) {
                reject(err);
              } else {
                fulfill(delOK);
              }
            });
        }).catch(reject);
    });
  }

  updateInDB(collectionName, query = {}, updateFn = () => { }) {
    return new Promise(async (fulfill, reject) => {
      const results = await this.findInDB(collectionName, query, {});
      if (!results[0]) {
        reject(Error('No data found'));
      }

      const setQuery = updateFn(results[0]);
      this.getDatabaseInstance()
        .then(db => {
          db.collection(collectionName)
            .updateOne(query, { $set: setQuery }, (err, res) => {
              if (err) {
                reject(err);
              } else {
                fulfill(res);
              }
            });
        }).catch(reject);
    });
  }

  getInvalidFieldsForMember(member) {
    const expectedFields = ['id','name','description','email','password','username','skills'];
    if (typeof member !== 'object') {
      return expectedFields;
    }

    // TODO: provide better validation
    const invalidFields = expectedFields.filter(f => !member[f]);
    return invalidFields;
  }

  // checks for valid fields
  isValidMember(member) {
    return this.getInvalidFieldsForMember(member).length === 0;
  }

  async addMember(member = {}) {
    if (!this.isValidMember(member)) {
      const missingFields = this.getInvalidFieldsForMember(member);
      const errorMessage = `Invalid Fields: ${missingFields.join(',')}`;
      throw Error(errorMessage);
    } else {
      await this.insertOneIntoDB('members', member);
    }
  }

  async deleteMember(query) {
    return await this.deleteInDB('members', query);
  }

  async updateMember(member = {}){
    await this.deleteMember({id: member.id});
    await this.addMember(member);
  }

  async findMember(query, fieldsToExclude = { password: 0 }) {
    return await this.findInDB('members', query, fieldsToExclude);
  }

  getInvalidFieldsForProject(project) {
    const expectedFields = ['id', 'name', 'description', 'members', 'releases', 'sprints', 'features', 'stories', 'tasks', 'pointHistory', 'auditLog', 'defaultSprintLength'];
    if (typeof project !== 'object') {
      return expectedFields;
    }

    // TODO: provide better validation
    const invalidFields = expectedFields.filter(f => !project[f]);
    return invalidFields;
  }

  // checks for valid fields
  isValidProject(project) {
    return this.getInvalidFieldsForProject(project).length === 0;
  }

  async addProject(project = {}) {
    if (!this.isValidProject(project)) {
      const missingFields = this.getInvalidFieldsForProject(project);
      const errorMessage = `Invalid Fields: ${missingFields.join(',')}`;
      throw Error(errorMessage);
    } else {
      await this.insertOneIntoDB('projects', project);
    }
  }

  async deleteProject(query) {
    return await this.deleteInDB('projects', query);
  }

  async findProject(query, fieldsToExclude = { password: 0 }) {
    return await this.findInDB('projects', query, fieldsToExclude);
  }

  // eslint-disable-next-line no-unused-vars
  getInvalidFieldsForStory(target, projectID) {
    const expectedFields = ['id', 'status', 'name', 'description', 'businessValue', 'tasks'];
    if (typeof target !== 'object') {
      return expectedFields;
    }

    // TODO: provide better validation, especially with using projectID
    const invalidFields = expectedFields.filter(f => !target[f]);
    return invalidFields;
  }

  // checks for valid fields
  isValidStory(target, projectID) {
    return this.getInvalidFieldsForStory(target, projectID).length === 0;
  }

  async addStory(projectID, newStory) {
    return await this.updateInDB('projects', { id: projectID }, (project) => {
      project.stories[newStory.id] = newStory;
      return { stories: project.stories };
    });
  }

  async deleteStory(projectID, storyID) {
    // eslint-disable-next-line no-console
    console.log('TODO: update anything related to this story');
    await this.updateInDB('projects', { id: projectID }, (project) => {
      delete project.stories[storyID];
      return { stories: project.stories };
    });
  }

  async updateStory(projectID, newStory) {
    await this.deleteStory(projectID, newStory.id);
    await this.addStory(projectID, newStory);
  }

  // eslint-disable-next-line no-unused-vars
  getInvalidFieldsForRelease(release, projectID) {
    const expectedFields = ['id', 'name', 'description', 'startDate', 'endDate', 'sprints', 'features'];
    if (typeof release !== 'object') {
      return expectedFields;
    }

    // TODO: provide better validation, especially with using projectID
    const invalidFields = expectedFields.filter(f => !release[f]);
    return invalidFields;
  }

  // checks for valid fields
  isValidRelease(release, projectID) {
    return this.getInvalidFieldsForRelease(release, projectID).length === 0;
  }

  async addRelease(projectID, newRelease) {
    return await this.updateInDB('projects', { id: projectID }, (project) => {
      project.releases[newRelease.id] = newRelease;
      return { releases: project.releases };
    });
  }

  async deleteRelease(projectID, releaseID) {
    // eslint-disable-next-line no-console
    console.log('TODO: update anything related to this release');
    await this.updateInDB('projects', { id: projectID }, (project) => {
      delete project.releases[releaseID];
      return { releases: project.releases };
    });
  }

  async updateRelease(projectID, newRelease){
    await this.deleteRelease(projectID, newRelease.id);
    await this.addRelease(projectID, newRelease);
  }

  async addFeature(projectID, newFeature) {
    return await this.updateInDB('projects', { id: projectID }, (project) => {
      project.features[newFeature.id] = newFeature;
      return { features: project.features };
    });
  }

  async deleteFeature(projectID, releaseID) {
    // eslint-disable-next-line no-console
    console.log('TODO: update anything related to this feature');
    await this.updateInDB('projects', { id: projectID }, (project) => {
      delete project.features[releaseID];
      return { releases: project.releases };
    });
  }

  async updateFeature(projectID, newFeature){
    await this.deleteFeature(projectID, newFeature.id);
    await this.addFeature(projectID, newFeature);
  }

  async addSprint(projectID, newSprint) {
    return await this.updateInDB('projects', { id: projectID }, (project) => {
      project.sprints[newSprint.id] = newSprint;
      return { sprints: project.sprints };
    });
  }

  async deleteSprint(projectID, sprintID) {
    // eslint-disable-next-line no-console
    console.log('TODO: update anything related to this sprint');
    await this.updateInDB('projects', { id: projectID }, (project) => {
      delete project.sprints[sprintID];
      return { sprints: project.sprints };
    });
  }

  async updateSprint(projectID, newSprint){
    await this.deleteSprint(projectID, newSprint.id);
    await this.addSprint(projectID, newSprint);
  }

  closeConnection () {
    return new Promise(async (fulfill, reject) => {
      try {
        const connectInstance = await this.getConnectionInstance();
        connectInstance.close();
        this.dbInstance = null;
        this.connectInstance = null;
        fulfill();
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = ColiberateDbWrapper;
