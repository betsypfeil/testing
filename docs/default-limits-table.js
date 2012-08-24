/** Generate a table with default resource limits. */

var path = require('path');
var fs = require('fs');

var sprintf = require('sprintf').sprintf;

var Account = require('../lib/db/models/account').Account;

var limits = Account.fields.limits.default_value;

function generateTable(file) {
  var key, value,
  str =  '<?xml version="1.0" encoding="UTF-8"?>' +
          '<informaltable rule="all" xmlns="http://docbook.org/ns/docbook"' +
          ' xmlns:xi="http://www.w3.org/2001/XInclude"' +
          ' xmlns:xlink="http://www.w3.org/1999/xlink" version="5.0"' +
          ' xml:id="section-default-limits-table">\n' +
             '<thead>' +
             '<tr>' +
             '<td>Resource</td>' +
             '<td>Limit</td>' +
             '</tr>' +
             '</thead>' +
             '<tbody>';

  for (key in limits) {
    value = limits[key];
    str += '<tr>';
    str += sprintf('<td>%s</td>', key);
    str += sprintf('<td>%s</td>', value);
    str += '</tr>';
  }

  str += '</tbody></informaltable>';
  fs.writeFileSync(file, str, 'utf8');
}

var file = path.join(__dirname, '/src/docbkx/partials/default_limits.xml');
generateTable(file);
