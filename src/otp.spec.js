import 'babel-polyfill';
import 'babel-core/register';

import test from 'ava';

import { delay } from 'redux-saga';
import { call, fork, race, cancel, join } from 'redux-saga/effects';
import { createMockTask } from 'redux-saga/utils';

import { checkGeneratorScenario as checkScenario } from './test-utils';

/* eslint-disable import/no-unresolved */
import { supervisor, ONE_FOR_ONE, ONE_FOR_MANY, PERMANENT, TEMPORARY } from 'build_TEMP';
import { ProcessSystem, States } from 'erlang-js'


// Data protocol examples

function* worker()    { yield call(delay, 1000); }
function* workerOne() { yield call(delay, 1000); }
function* workerTwo() { yield call(delay, 1000); }

const mockWorker         = createMockTask(),
  mockWorkerOne          = createMockTask(),
  mockWorkerTwo          = createMockTask(),

  permanentWorkerSpec    = { start: worker,    restart: PERMANENT, id: '0' },
  temporaryWorkerSpec    = { start: worker,    restart: TEMPORARY, id: '0' },
  firstWorkerSpec        = { start: workerOne, restart: PERMANENT, id: 'first' },
  secondWorkerSpec       = { start: workerTwo, restart: PERMANENT, id: 'second' },

  workerRace             = race({ '0': join(mockWorker) }),
  workersRace            = race({ 'first': join(mockWorkerOne), 'second': join(mockWorkerTwo) }),

  workerTerminated       = { '0': '0' },
  firstWorkerTerminated  = { 'first': 'first' },
  secondWorkerTerminated = { 'second': 'second' },

  waitedLongEnough       = { waitedLongEnough: true },
  restartFreqError       = { error: { message: 'Restart frequency limit reached' } },

  timedWorkerRace        = race({ waitedLongEnough: call(delay, 1000, true), '0': join(mockWorker) }),
  timedWorkersRace       = race({
    waitedLongEnough: call(delay, 1000, true),
    'first': join(mockWorkerOne),
    'second': join(mockWorkerTwo)
  });

let sys;
test.beforeEach(t => {
  sys = new ProcessSystem();
})

test('erl system works', t => {
  const pid = sys.spawn(function* () {
    yield 1;
  });

  t.is(sys.list().length, 2);
  t.is(sys.list()[1], pid)
});

test('supervisor: one-for-one, temporary child, simple', t => {
  const pid = sys.spawn(() => supervisor.init({
    supFlags: { strategy: ONE_FOR_ONE },
    childSpecs: [temporaryWorkerSpec]
  }));

  // initialization

  sys.send(pid, null)
  sys.receive(out => t.deepEqual(out, fork(worker)));

  sys.send(mockWorker);                   // spawns first (and only) worker
  sys.receive(out => t.deepEqual(out, timedWorkerRace));
  sys.receive(() => t.fail());
});


test('supervisor: one-for-one, max restart frequency', t => {
  // initialization
  const supervisorIter = supervisor.init({
    supFlags: { strategy: ONE_FOR_ONE, maxR: 1, maxT: 1 },
    childSpecs: [permanentWorkerSpec]
  });

  checkScenario(t, supervisorIter, [
    null,

    fork(worker), mockWorker,       // spawns first (and only) worker

                                    // main loop:

    race({                          // yields worker and delay race
      0: join(mockWorker),
      waitedLongEnough: call(delay, 1, true)
    }),

    waitedLongEnough,               // if waited long enough,
    workerRace,                     // workers race is yielded

    workerTerminated,               // when worker terminates,
    fork(worker), mockWorker,       // it gets restarted


    race({                          // yields worker and delay race
      0: join(mockWorker),
      waitedLongEnough: call(delay, 1, true)
    }),
    workerTerminated,               // if worker terminates more frequently than permitted,
    restartFreqError                // supervisor dies

  ]);
});


test('supervisor: one-for-one, multi', t => {
  // initialization
  const supervisorIter = supervisor.init({
    supFlags: { strategy: ONE_FOR_ONE },
    childSpecs: [firstWorkerSpec, secondWorkerSpec]
  });

  checkScenario(t, supervisorIter, [
    null,

    fork(workerOne), mockWorkerOne, // spawns first worker
    fork(workerTwo), mockWorkerTwo, // spawns second worker

                                    // main loop:

    timedWorkersRace,               // yields workers and delay race
    waitedLongEnough,               // if delay does trigger,
    workersRace,                    // yields workers race

    firstWorkerTerminated,          // when first worker terminates,
    fork(workerOne), mockWorkerOne, // it gets restarted

    timedWorkersRace,               // the same with worker 1
    waitedLongEnough,
    workersRace,

    secondWorkerTerminated,
    fork(workerTwo), mockWorkerTwo,

    timedWorkersRace,
    firstWorkerTerminated,          // if any worker terminates,
    restartFreqError                // supervisor dies
  ]);
});


test('supervisor: all-for-one, multi', t => {
  // initialization
  const supervisorIter = supervisor.init({
    supFlags: { strategy: ONE_FOR_MANY },
    childSpecs: [firstWorkerSpec, secondWorkerSpec]
  });

  checkScenario(t, supervisorIter, [
    null,

    fork(workerOne), mockWorkerOne, // initialization:
    fork(workerTwo), mockWorkerTwo, // spawns workers

                                    // main loop:
    timedWorkersRace,               // listens for workers termination
    waitedLongEnough,
    workersRace,

    firstWorkerTerminated,          // when first worker terminates:
    fork(workerOne), mockWorkerOne, // it gets restarted,

    cancel(mockWorkerTwo), null,    // and second gets restarted too
    fork(workerTwo), mockWorkerTwo,
  ]);
});

