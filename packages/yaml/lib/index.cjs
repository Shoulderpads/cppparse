'use strict';

const binding = require('node-gyp-build')(__dirname + '/..');

function parse(text) {
  return binding.parse(String(text));
}

function stringify(value) {
  return binding.stringify(value);
}

module.exports = { parse, stringify };
