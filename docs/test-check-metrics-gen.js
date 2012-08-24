var pathSetup = require('../lib/util/path_setup').pathSetup;
pathSetup();

var fs = require('fs');
var assert = require('assert');
var terminal = require('terminal');

var settings = require('util/settings');


var logmagic = require('logmagic');
var log = logmagic.local('end-to-end');

var async = require('async');
var sprintf = require('sprintf').sprintf;
var AuthedPublicAPIClient = require('api_client/base').AuthedPublicAPIClient;
var misc = require('util/misc');
var request = require('rackspace-shared-utils/lib/request').request;
var getMatchingOrCreate = require(__dirname + '/../contrib/client_utils').getMatchingOrCreate;


function l() {
  console.log(sprintf.apply(null, arguments));
}

logmagic.route('ele.lib.api_client.*', logmagic.INFO, settings.LOG_METHOD);

/*
 * {username: '', key: ''}
 */
cfg = fs.readFileSync(__dirname + '/../contrib/settings.json');
cfg = JSON.parse(cfg);

var pa = new AuthedPublicAPIClient('ele-api.k1k.me', 443, '1.0', cfg.username, cfg.key, {ssl: true});

var HTTP_HOST = 'www.google.com',
    HTTPS_HOST = HTTP_HOST;

var en,
    mr = {},
    start = new Date();

function getTempl(alias, type, details) {
  return {
    label: 'test-check',
    target_alias: alias,
    period: 30,
    timeout: 5,
    monitoring_zones_poll: [mz.key],
    type: type,
    details: details
  };
}

function complete(mr, type, callback) {
  return function(err, result) {
    var item = result[0],
        key, keys, i,
        metric,
        metrics = {};

    if (err) {
      callback(err);
      return;
    }

    keys = Object.keys(item.metrics).sort();

    for (i = 0; i < keys.length; i++) {
      key = keys[i];
      metric = item.metrics[key];
      if (metric.type !== 's') {
        metric.data = Number(metric.data);
      }
      metrics[key] = metric;
    }
    item.metrics = metrics;
    mr[type] = item;
    l('Completed: %s check', type);
    callback();
  }
}

async.auto({
  mzs: function(callback) {
    pa.monitoringZones.list({}, function(err, data) {
      if (err) {
        callback(err);
        return;
      }
      mz = data.values[0];
      l('Found item! %s', JSON.stringify(mz));
      callback();
    });
  },
  entity: function(callback) {
    var enTempl = {
      label: 'test-check-entity',
      ip_addresses: {
        google: '74.125.224.144',
        googleDns: '8.8.8.8',
        oshell0: '184.106.176.152',
        googleSmtp: '74.125.47.108',
        ftpmozilla: '63.245.209.137'
      },
      metadata: {
        key: 'test-entity-value'
      }
    };

    getMatchingOrCreate(pa.entities, enTempl, null, function(item) {
      return (item.label === enTempl.label);
    }, function(err, result) {
      if (err) {
        callback(err);
        return;
      }
      en = result;
      callback();
    });

  },
  'remote.dns': ['entity', 'mzs', function(callback) {
    var type = 'remote.dns';
    pa.checks.test(en.key,
                   getTempl('googleDns', type,
                            {
                              query: 'google.com',
                              record_type: 'A'
                            }),
                   complete(mr, type, callback));
  }],
  'remote.smtp-banner': ['entity', 'mzs', function(callback) {
    var type = 'remote.smtp-banner';
    pa.checks.test(en.key,
                   getTempl('googleSmtp', type,
                            {
                              port: 465,
                              ssl: "true"
                            }),
                   complete(mr, type, callback));
  }],
  'remote.http': ['entity', 'mzs', function(callback) {
    var type = 'remote.http';
    pa.checks.test(en.key,
                   getTempl('google', type,
                            {
                              url: sprintf('https://%s/', HTTP_HOST),
                                body: '.*',
                                body_matches: {'one': '.*', 'two': '.*'}
                              method: 'GET'
                            }),
                   complete(mr, type, callback));
  }],
  'remote.ping': ['entity', 'mzs', function(callback) {
    var type = 'remote.ping';
    pa.checks.test(en.key,
                   getTempl('oshell0', type,
                            {
                            }),
                   complete(mr, type, callback));
  }],
  'remote.ssh': ['entity', 'mzs', function(callback) {
    var type = 'remote.ssh';
    pa.checks.test(en.key,
                   getTempl('oshell0', type,
                            {
                              url: sprintf('https://%s/', HTTP_HOST),
                              body: '.*',
                              method: 'GET'
                            }),
                   complete(mr, type, callback));
  }],
  'remote.tcp': ['entity', 'mzs', function(callback) {
    var type = 'remote.tcp';
    pa.checks.test(en.key,
                   getTempl('oshell0', type,
                            {
                              banner_match: '.*',
                              port: 22
                            }),
                   complete(mr, type, callback));
  }],
  'remote.ftp-banner': ['entity', 'mzs', function(callback) {
    var type = 'remote.ftp-banner';
    pa.checks.test(en.key,
                   getTempl('ftpmozilla', type,
                            {
                            }),
                   complete(mr, type, callback));
  }]
}, function(err, result) {
  if (err) {
    console.error(err);
    console.log(err.data.message, err.data.details);
  }
  for (k in mr) {
    fs.writeFileSync(__dirname + '/src/docbkx/metrics/generated-' + k + '.json', JSON.stringify(mr[k], null, 2));
  }
  l('Script took %ds to complete!', (new Date() - start) / 1000);
});
