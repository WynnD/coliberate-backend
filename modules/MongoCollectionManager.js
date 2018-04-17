const MongoConnector = require('./MongoConnector');
class MongoCollectionManager {
  constructor(connector = new MongoConnector(), collectionName = '') {
    this._connector = connector;
    this._collectionName = collectionName;
  }

  insertOneIntoDB(entity) {
    return new Promise((fulfill, reject) => {
      // this.getDatabaseInstance()
      this._connector.databaseInstance
        .then(db => {
          db.collection(this._collectionName).insertOne(entity, (err/*, res*/) => {
            if (err) {
              reject(err);
            } else {
              fulfill();
            }
          });
        }).catch(reject);
    });
  }

  findInDB(query = {}, fieldsToExclude = {}) {
    return new Promise((fulfill, reject) => {
      // this.getDatabaseInstance()
      this._connector.databaseInstance
        .then(db => {
          db.collection(this._collectionName)
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

  deleteInDB(query) {
    return new Promise((fulfill, reject) => {
      if (!query) {
        reject(Error('No query defined for dropMember'));
      }
      // this.getDatabaseInstance()
      this._connector.databaseInstance
        .then(db => {
          db.collection(this._collectionName)
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

  dropCollectionInDB() {
    return new Promise((fulfill, reject) => {
      // this.getDatabaseInstance()
      this._connector.databaseInstance
        .then(db => {
          db.collection(this._collectionName)
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

  updateInDB(query = {}, updateFn = () => {}) {
    return new Promise(async (fulfill, reject) => {
      const results = await this.findInDB(this._collectionName, query, {});
      if (!results[0]) {
        reject(Error('No data found'));
      }

      const setQuery = updateFn(results[0]);
      this.getDatabaseInstance()
        .then(db => {
          db.collection(this._collectionName)
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

  closeConnection () {
    return this._connector.closeConnection();
  }
}

module.exports = MongoCollectionManager;
