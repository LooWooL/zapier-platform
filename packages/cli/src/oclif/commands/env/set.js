const { cyan } = require('colors/safe');
const { omit } = require('lodash');

const BaseCommand = require('../../ZapierBaseCommand');
const { buildFlags } = require('../../buildFlags');
const { callAPI, getLinkedApp } = require('../../../utils/api');

const successMessage = version =>
  `Successfully wrote the following to the environment of version ${cyan(
    version
  )}:`;

class SetEnvCommand extends BaseCommand {
  async perform() {
    const { version } = this.args;
    this.throwForInvalidVersion(version);
    // args should be [ '1.0.0', 'qer=123', 'qwer=123' ]
    const valuesToSet = this.argv.slice(1).filter(kv => !kv.startsWith('-'));

    if (!valuesToSet.length) {
      this.error(
        'Must specify at least one key-value pair to set (like `SOME_KEY=1234`)'
      );
    }

    if (!valuesToSet.every(kv => kv.includes('='))) {
      this.error('Every key-value pair must be in the format `SOME_KEY=1234`');
    }

    // if we get here, we should have well-formed input

    const payload = valuesToSet.reduce((result, kvPair) => {
      const key = kvPair.split('=')[0]
      const value = kvPair.split(/=(.+)/)[1] // Guards against SECURE_KEY=8n*e9!=92g
      result[key.toUpperCase()] = value;
      return result;
    }, {});

    const app = await getLinkedApp();

    const url = `/apps/${app.id}/versions/${version}/multi-environment`;

    try {
      // currently, this returns nothing
      await callAPI(
        url,
        {
          body: payload,
          method: 'POST'
        },
        true
      );

      this.log(successMessage(version));
      this.logJSON(payload);
    } catch (e) {
      // comes back as json: { errors: [ 'The following keys failed to update: 3QER, 4WER' ] },
      const failedKeys = e.json.errors[0].split('update: ')[1].split(', ');
      const successfulResult = omit(payload, failedKeys);
      if (!Object.keys(successfulResult).length) {
        this.error(e.json.errors);
      }

      this.warn(successMessage(version));
      this.logJSON(successfulResult);
      this.warn(`However, these keys failed to update: ${failedKeys}`);
    }
  }
}

SetEnvCommand.args = [
  {
    name: 'version',
    description:
      'The version to set the environment for. Values are copied forward when a new version is created, but this command will only ever affect the specified version.',
    required: true
  },
  {
    name: 'key-value pairs...',
    description:
      'The key-value pairs to set. Keys are case-insensitive. Each pair should be space separated and pairs should be separated by an `=`. For example: `A=123 B=456`'
  }
];
SetEnvCommand.flags = buildFlags();
SetEnvCommand.description = `Set environment variables for a version.`;
SetEnvCommand.examples = [`zapier env:set 1.2.3 SECRET=12345 OTHER=4321`];
SetEnvCommand.strict = false;

module.exports = SetEnvCommand;
