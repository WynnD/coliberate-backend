const MongoCommand = require('../MongoCommand');
const MongoConnector = require('../MongoConnector');
class MemberCommand extends MongoCommand{
  constructor (connector = new MongoConnector()) {
    super(connector, 'members');
  }

  getInvalidFieldsFor(member) {
    const expectedFields = ['id', 'name', 'description', 'email', 'password', 'username', 'skills'];
    if (typeof member !== 'object') {
      return expectedFields;
    }

    // TODO: provide better validation
    const invalidFields = expectedFields.filter(f => !member[f]);
    return invalidFields;
  }

  async update(member) {
    await this.add(member);
  }

  async find(query, fieldsToExclude = { password: 0 }) {
    return super.find(query, fieldsToExclude);
  }
}

module.exports = MemberCommand;
