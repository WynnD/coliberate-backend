const MongoConnector = require('./MongoConnector');
const MongoCollectionManager = require('./MongoCollectionManager');

class MongoCommand {
  constructor(connector = new MongoConnector(), collectionName = '') {
    this._manager = new MongoCollectionManager(connector, collectionName);
  }

  // eslint-disable-next-line no-unused-vars
  getInvalidFieldsFor(entity = {}) {
    return [];
  }

  isValid(entity = {}) {
    return this.getInvalidFieldsFor(entity).length === 0;
  }

  async add(entity = {}) {
    if (!this.isValid(entity)) {
      const missingFields = this.getInvalidFieldsFor(entity);
      const errorMessage = `Invalid Fields: ${missingFields.join(', ')}`;
      throw Error(errorMessage);
    } else {
      return await this._manager.insertOneIntoDB(entity);
    }
  }

  async delete(query) {
    return await this._manager.deleteInDB(query);
  }

  async find(query, fieldsToExclude = {}) {
    return await this._manager.findInDB(query, fieldsToExclude);
  }

  async update(entity = {}, updateFn = () => {}) {
    return await this._manager.updateInDB(entity, updateFn);
  }

  async drop() {
    return await this._manager.dropCollectionInDB();
  }

  closeConnection() {
    return this._manager.closeConnection();
  }
}

module.exports = MongoCommand;
