/**
 * OTP
 *
 * Docs {@link http://erlang.org/doc/design_principles/des_princ.html Here}.
 * @namespace OTP
 *
 */

/* eslint-disable no-continue */

import { delay } from 'redux-saga';
import { fork, race, call, cancel, join } from 'redux-saga/effects';
import { prop, values, map, has, head, compose, reject, merge } from 'ramda';


export const ONE_FOR_ONE = 'ONE_FOR_ONE',
  ONE_FOR_MANY = 'ONE_FOR_MANY',

  PERMANENT = 'PERMANENT',
  TEMPORARY = 'TEMPORARY';


const debug = require('debug');

/**
 * Supervisor OTP behavior
 *
 * Docs {@link http://erlang.org/documentation/doc-4.9.1/doc/design_principles/sup_princ.html Here}.
 * @memberof OTP
 *
 */
export const supervisor = {
  debug: debug('otp/supervisor'),

  *start_link(task, id) {
    supervisor.debug('start_link', { task, id });
    yield call(task);
    return id;
  },

  *init({
    supFlags = { },
    childSpecs = []
  }) {
    const { strategy = ONE_FOR_ONE, maxR = 1, maxT = 1000 } = supFlags;

    supervisor.debug('init', { supFlags, childSpecs });
    const children = {};

    for (const child of childSpecs) {
      const { id, start, restart = PERMANENT } = child;

      // fork worker
      const task = yield fork(start);
      supervisor.debug('init: forked', id);

      children[id] = { id, task, start, restart, terminated: false };
    }

    while (true) {
      const tasks = compose(
        map(join),
        map(prop('task')),
        reject(prop('terminated'))
      )(children);

      supervisor.debug('init: loop', { tasks });

      const waitedLongEnough = yield race(merge(tasks,
        { waitedLongEnough : call(delay, maxT / maxR, true) }
      ));

      if (!has('waitedLongEnough', waitedLongEnough)) {
        supervisor.debug('init: not waited long enough', { waitedLongEnough });
        throw new Error('Restart frequency limit reached');
      }

      const terminatedId = head(values(yield race(tasks)));

      supervisor.debug('init: %s terminated', terminatedId);


      if (strategy === ONE_FOR_MANY) {
        // restart all workers
        for (const child of values(children)) {
          if (child.id !== terminatedId) {
            yield cancel(child.task);
          }

          if (child.restart === PERMANENT) {
            children[child.id].task = yield fork(child.start);
          } else {
            children[child.id].terminated = true;
          }
        }
        continue;
      } else {
        // restart a worker
        if (children[terminatedId].restart === PERMANENT) {
          children[terminatedId].task = yield fork(children[terminatedId].start);
        } else {
          children[terminatedId].terminated = true;
        }
        continue;
      }
    }
  }
};

