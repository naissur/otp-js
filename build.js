#!/usr/bin/env node

'use strict'

var fs = require('fs')
var join = require('path').join
var argv = require('minimist')(process.argv.slice(2))

var configFilename = argv.c || 'rollem.config.js'

var configName = join(process.cwd(), configFilename)
if (!fs.existsSync(configName)) {
  console.error('Cannot find', configName)
  process.exit(-1)
}

var rollup = require('rollup')
var rollem = require('rollem')

function isWatchArgument (arg) {
  return arg === '-w' || arg === '--watch'
}
var isWatching = process.argv.some(isWatchArgument)
var options = {
  watch: isWatching
}

rollup.rollup({
  entry: configFilename
}).then(function (bundle) {
  var code = bundle.generate({
    format: 'cjs'
  }).code;
  var config = eval(code) // eslint-disable-line no-eval

  rollem(config, options)
    .catch((err) => {
      console.error('Problem rolling them')
      console.error(err.message)
      console.error(err.stack)
      process.exit(-1)
    })
}).catch(console.error)
