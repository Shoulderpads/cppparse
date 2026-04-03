const path = require('path');
const binding = require('node-gyp-build')(path.join(__dirname, '..'));

exports.parse = function parse(text) {
  return binding.parse(String(text));
};

exports.stringify = function stringify(value) {
  return binding.stringify(value);
};
