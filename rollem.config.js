import resolve from 'rollup-plugin-node-resolve';
import common from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';

const config = {
  format: 'cjs',
  sourceMap: true,
  plugins: [
    common(),
    resolve({
      skip: [ 'redux-saga', 'redux-saga/effects', 'ramda', 'tap', 'babel-polyfill', 'debug', 'build_TEMP' ],
      preferBuiltins: false  // Default: true
    }),
    babel({
      babelrc: false,
      presets: [
        'stage-0',
        ['es2015', { 'modules': false }]
      ],
      plugins: ['external-helpers'],
    }),
  ]
}

export default [
  Object.assign({}, config, {
    entry: 'src/index.js',
    dest: 'build/index.js'
  }),
  Object.assign({}, config, {
    entry: 'src/test.js',
    dest: 'build/test.js'
  })
];
