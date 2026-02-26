/**
 * Custom Jest sequencer — runs integration test files in alphabetical order
 * (01-*, 02-*, …, 10-*) so the output is predictable and readable.
 */

'use strict';

const Sequencer = require('@jest/test-sequencer').default;

class AlphabeticalSequencer extends Sequencer {
  sort(tests) {
    return [...tests].sort((a, b) => a.path.localeCompare(b.path));
  }
}

module.exports = AlphabeticalSequencer;
