/**
 * Testing utils
 *
 * @namespace TestUtils
 *
 */

import { path } from 'ramda';

export const resumeIteratorAndCheckOutput = (t, iterator) => (into, outof) => {
  let value;

  try {
    value = iterator.next(into).value;
    return t.deepEqual(value, outof);
  } catch (e) {
    return t.deepEqual(e.message, path(['error', 'message'], outof));
  }
};

/**
 * checks generator scenario
 *
 * this is equivalent to:
 * asserting that two iterators are equal, when given the same input
 *
 * @param {NodeTap} t node-tap instance
 * @param {Iterator} iter
 * @param {[]} scenario Scenario data
 * @returns {void}
 *
 * @memberof TestUtils
 */
export const checkGeneratorScenario = (t, iter, scenario) => {
  const next = resumeIteratorAndCheckOutput(t, iter);

  for (let i = 0; i < scenario.length - 1; i += 2) {
    const input = scenario[i];
    const output = scenario[i + 1];
    next(input, output);
  }
};

