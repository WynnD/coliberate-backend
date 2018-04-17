const mongo = require('mongodb');

class MongoConnector {
  constructor(url = '', dbName = 'coliberate') {
    this._MongoClient = mongo.MongoClient;
    this._url = url;
    this._dbName = dbName;
    this._connectInstance = null;
    this._dbInstance = null;
  }

  get connectionInstance() {
    return new Promise((fulfill, reject) => {
      if (!this._connectInstance) {
        this._MongoClient.connect(this._url, (err, instance) => {
          if (err) {
            reject(err);
          } else {
            this._connectInstance = instance;
            fulfill(this._connectInstance);
          }
        });
      } else {
        fulfill(this._connectInstance);
      }
    });
  }

  get databaseInstance() {
    if (!this._dbInstance) {
      return this.connectionInstance
        .then(conInstance => {
          this._dbInstance = conInstance.db(this._dbName);
          return this._dbInstance;
        });
    } else {
      return Promise.resolve(this._dbInstance);
    }
  }

  closeConnection() {
    return new Promise(async (fulfill, reject) => {
      try {
        const connectInstance = await this.connectionInstance;
        connectInstance.close();
        this._dbInstance = null;
        this._connectInstance = null;
        fulfill();
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = MongoConnector;
