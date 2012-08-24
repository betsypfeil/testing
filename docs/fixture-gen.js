var pathSetup = require('../lib/util/path_setup').pathSetup;

pathSetup();

var jade = require('jade');
var sys = require('util');
var fs = require('fs');
var path = require('path');
var swiz = require('swiz');
var async = require('async');
var help = swiz.help;
var fs = require('fs');
var dbu = require('../lib/api/defs');

var FIXTURES = ['client-docs', 'tutorial'];
var spawn = require('child_process').spawn;


function getFixture(fixture, callback) {
  var loader,
      result,
      item,
      i, j, l, _serialize = ["xml", "json"],
      dataset,
      name,
      fixture,
      message,
      filename,
      list = [],
      prefix = __dirname + '/src/docbkx/partials/';

  // Load the actual fixture
  loader = require("../tests/fixtures/" + fixture);
  if (!loader) {
    throw new Error("Unable to find fixture named " + fixture);
  }
  if (!loader.fixture) {
    return;
  }

  if (!path.existsSync(prefix)) {
    fs.mkdirSync(prefix, 0777);
  }

  result = loader.fixture.fetchAllMessages();
  for (i=0, l=result.length; i<l; i++) {
    item = result[i];

    // expand out the attributes
    dataset = item[0];
    name = item[1];
    fixture = item[2];
    message = item[3];

    for (j = 0; j < _serialize.length; j++) {
      ser = _serialize[j];
      filename = prefix + dataset + "_" + name + "." + ser;
      list.push([filename, fixture[ser], ser]);
    }
  }
  async.forEachSeries(list, doSerialize, function(err) {
    callback(err);
  });
  return result
}


function doSerialize(fileTuple, callback) {
  var fn = fileTuple[0],
      exe,
      dataAccum = '',
      fc = fileTuple[1],
      fmt = fileTuple[2];


  wStream = fs.createWriteStream(fn);
  if (fmt === 'xml') {
    exe = spawn('xmllint', ['--format', '-']);
    exe.stdin.write(fc);
    exe.stdin.end();
    exe.stdout.on('data', function(data) {
      dataAccum = dataAccum + data;
      wStream.write(data);
    });
    exe.stderr.on('data', function(data) {
      console.log('ERROR!:', data.toString());
    });
    exe.on('exit', function(code) {
      callback(null, dataAccum);
    });
  } else {
    wStream.write(fc);
    callback();
  }
}


function processFixtures(callback) {
  async.forEachSeries(FIXTURES, getFixture, callback);
}

processFixtures(function(err) {
  if (err) {
    console.error(err);
    return;
  }
});
