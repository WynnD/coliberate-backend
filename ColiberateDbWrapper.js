const mongo = require('mongodb');

class ColiberateDbWrapper {
  constructor(url) {
    this.MongoClient = mongo.MongoClient;
    this.url = url;
    this.dbName = 'coliberate';
    this.connectInstance = null;
    this.dbInstance = null;
    // this.collections = {
    //   members: null
    // }
  }

  getConnectionInstance() {
    return new Promise((fulfill, reject) => {
      if (!this.instance) {
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
          db.collection(collectionName).insertOne(entity, (err, res) => {
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

  // checks for valid fields
  isValidMember(member) {
    if (typeof member !== 'object') {
      return false;
    } else {
      const expectedFields = ['username', 'password', 'id', 'name', 'email', 'name'];
      const hasAMissingField = expectedFields.filter(f => !member[f]).length > 0;
      
      if (hasAMissingField) {
        return false;
      }
    }

    return true;
  }

  async addMember(member = {}) {
    if (!this.isValidMember(member)) {
      throw Error('Invalid member');
    } else {
      const db = await this.getDatabaseInstance();
      await this.insertOneIntoDB('members', member);
    }
  }

  async deleteMember(query) {
    return await this.deleteInDB('members', query);
  }

  async findMember(query) {
    return await this.findInDB('members', query);
  }

  async searchMembers(query = {}, fieldsToExclude = { password: 0 }) {
    return await this.findInDB('members', query, fieldsToExclude);
  }

  async closeConnection() {
    const dbInstance = await this.getDatabaseInstance();
    dbInstance.close();
    this.dbInstance = null;
    this.connectInstance = null;
  }
}

module.exports = ColiberateDbWrapper;
