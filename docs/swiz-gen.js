var pathSetup = require('../lib/util/path_setup').pathSetup;

pathSetup();

var sys = require('util');
var fs = require('fs');
var path = require('path');

var swiz = require('swiz');
var help = swiz.help;
var sprintf = require('sprintf').sprintf;

var dbu = require('../lib/api/defs');
var REMOTE_CHECK_TYPES = require('../lib/db/models/check_type').REMOTE_CHECK_TYPES;
var CHECK_TYPES = require('../lib/db/models/check_type').CHECK_TYPES;

var REMOTE_CHECK_TYPES_REVERSE = require('../lib/db/models/check_type').REMOTE_CHECK_TYPES_REVERSE;
var CHECK_TYPES_REVERSE = require('../lib/db/models/check_type').CHECK_TYPES_REVERSE;

var messengers = require('../lib/messenger/handlers');
var checkTypes, reverseCheckTypes;

var argv = require('optimist')
  .usage('Usage: $0 [-a]')
  .alias('a','include-agent')
  .describe('a','include the agent')
  .argv;

/**
 * For which target the fixtures are generated.
 * @type {String}
 * @const
 */
var GENERATE_FOR = 'public';


/**
 * The tags that have a string value in the help that can be dropped.
 * @type {Array}
 * @const
 */
var STRING_TAGS = ['regex', 'len'];

/** This is a bit of an ugly hack, but neither Tomaz nor I (ken) could figure 
 * out how to generalize it.  It's OK.  I'm sure it'll just get JIT-ed out. :)
 */
function hasDuplicatedStringValves(chain) {
  return chain.some(function (element, index, array) {
    return STRING_TAGS.indexOf(element.name) !== -1;
  });
};

/** Generate a single row of the table for a given field in a message */
function generateLine(name, desc, chain) {
  var schema, v, str, i, l, validation, filterStr;
  str = '<tr>\n<td><command>' + name + '</command></td>\n';
  if (desc !== undefined) {
    str = str + '<td>' + desc + '</td>\n<td>';
  } else {
    str = str + '<td></td>\n<td>';
  }
  if (chain !== undefined) {
    schema = { 'a' : chain };
    v = new swiz.Valve( schema );
    validation = v.help().a;
    filterStr = hasDuplicatedStringValves(v.schema.a.validators)
    l = validation.length;
    if (i !== 0) {
      str = str + '<itemizedlist>';
    }
    for (i = 0; i<l; i++) {
      if (!(validation[i] === 'String' && filterStr)) {
        if ((name === 'check_type' || name === 'type')  && validation[i].indexOf('remote.') !== -1) {
          // Hude hack. Pretend you didn't see it. We agreed to do this temporary
          // hack, until we fix the fixture system to use the public api for
          // generating fixtures.
          validation[i] = sprintf('One of (%s)', Object.keys(reverseCheckTypes).join(', '));
        }

        str = str + '<listitem><para>' + validation[i] + '</para></listitem>\n';
      }
    }
    if (i !== 0) {
      str = str + '</itemizedlist>';
    }
  }

  str = str + '</td>\n</tr>\n';
  return str;
}

function fieldSort(a, b) {
  return a.name > b.name;
}

function sortDefFields(def) {
  var fields = def.fields, optionalFields = [], requiredFields = [];

  fields.forEach(function(field) {
    if (field.ignorePublic) {
      return;
    }
    if (field.filterFrom.length > 0 && field.filterFrom.indexOf(GENERATE_FOR) !== -1) {
      return;
    }
    validations = dbu.validity[def.name][field.name];
    validations.isOptional ? requiredFields.push(field) : optionalFields.push(field);
  });

  requiredFields.sort(fieldSort);
  optionalFields.sort(fieldSort);

  return [].concat(optionalFields, requiredFields);
}

function groupFields(def) {
  var groups = {};
  var fields = def.fields;
  fields.forEach(function(field) {
    var group = 'main';
    if (field.ignorePublic) {
      return;
    }
    if(field.hasOwnProperty('group')) {
      group = field.group;
    }
    if (!groups.hasOwnProperty(group)) {
      groups[group] = {fields: [], name: def.name};
    }
    groups[field.group].fields.push(field);
  });
  Object.keys(groups).forEach(function(group) {
    groups[group] = sortDefFields(groups[group]);
  });
  return groups;
}

function sortCtFields(def) {
  var fields = def.fields, optionalFields = [], requiredFields = [];

  fields.forEach(function(field) {
    if (field.ignorePublic) {
      return;
    }
    if (field.filterFrom.length > 0 && field.filterFrom.indexOf(GENERATE_FOR) !== -1) {
      return;
    }
    validations = field.val;
    validations.isOptional ? requiredFields.push(field) : optionalFields.push(field);
  });

  requiredFields.sort(fieldSort);
  optionalFields.sort(fieldSort);

  return [].concat(optionalFields, requiredFields);
}


function generateDefFragment(def, title, filename) {
  var fields = def.fields, sortedFields, len, i, field, str, validations;

  title = title[0].toUpperCase() + title.substring(1);
  str = '<?xml version="1.0" encoding="UTF-8"?>' +
        '<section xmlns="http://docbook.org/ns/docbook"' +
        ' xmlns:xi="http://www.w3.org/2001/XInclude"' +
        ' xmlns:xlink="http://www.w3.org/1999/xlink" version="5.0"' +
        ' xml:id="section-' + title + '">\n' +
        '<title>Attributes</title>\n' +
        '<para>';
  str = str + '<informaltable rules ="all">\n';
  str = str + '<thead>\n';
  str = str + '<tr><td>Name</td><td>Description</td><td>Validation</td></tr>\n';
  str = str + '</thead>\n';
  str = str + '<tbody>';

  if (def.groups) {
    groupedFields = groupFields(def);
    Object.keys(groupedFields).forEach(function(group) {
      str = str + '<tr><td colspan="3"><emphasis>' + def.groups[group] + '</emphasis></td></tr>\n';
      sortedFields = groupedFields[group];
      sortedFields.forEach(function(field) {
        validations = dbu.validity[def.name][field.name];
        str = str + generateLine(field.name, field.desc, validations);
      });
    });
  } else {
    sortedFields = sortDefFields(def);
    sortedFields.forEach(function(field) {
      validations = dbu.validity[def.name][field.name];
      str = str + generateLine(field.name, field.desc, validations);
    });
  }
  str = str + '</tbody></informaltable>\n';
  str = str + '</para></section>';
  fs.writeFileSync(filename, str);
}

function generateMessenger(def, title, filename) {
  var fields = def.fields, sortedFields, len, i, field, str, validations;

  title = title[0].toUpperCase() + title.substring(1);
  str = '<?xml version="1.0" encoding="UTF-8"?>' +
        '<section xmlns="http://docbook.org/ns/docbook"' +
        ' xmlns:xi="http://www.w3.org/2001/XInclude"' +
        ' xmlns:xlink="http://www.w3.org/1999/xlink" version="5.0"' +
        ' xml:id="section-' + title + '">\n' +
        '<title>Attributes</title>\n' +
        '<para>';
  str = str + '<informaltable rules ="all">\n';
  str = str + '<thead>\n';
  str = str + '<tr><td>Name</td><td>Description</td><td>Validation</td></tr>\n';
  str = str + '</thead>\n';
  str = str + '<tbody>';

  for (i = 0, len = def.length; i < len; i++) {
    field = def[i];
    str = str + generateLine(field.name, field.desc, field.val);
  }

  str = str + '</tbody></informaltable>\n';
  str = str + '</para></section>';
  fs.writeFileSync(filename, str);
}


/**
 * Generate fragment for the available check types table.
 */
function generateCheckListFragment(checkTypes, title, filename) {
  // TODO: Refactor
  var key, ct, i, fields, field, len, rec, str;
  str = '<?xml version="1.0" encoding="UTF-8"?>' +
        '<section xmlns="http://docbook.org/ns/docbook"' +
        ' xmlns:xi="http://www.w3.org/2001/XInclude"' +
        ' xmlns:xlink="http://www.w3.org/1999/xlink" version="5.0"' +
        ' xml:id="section-' + title + '">\n' +
        '<title>Available Check Types and Fields</title>\n' +
        '<itemizedlist>';

  for (key in checkTypes) {
    if (checkTypes.hasOwnProperty(key)) {
      str += '<listitem>' + key + '</listitem>';
    }
  }

  str = str + '</itemizedlist></section>';
  fs.writeFileSync(filename, str);
}


/**
 * Generate fragment for the available check types table.
 */
function generateCheckTypesFragment(checkTypes, title, filename) {
  // TODO: Refactor
  var key, ct, i, fields, field, len, rec, str;
  str = '<?xml version="1.0" encoding="UTF-8"?>' +
        '<section xmlns="http://docbook.org/ns/docbook"' +
        ' xmlns:xi="http://www.w3.org/2001/XInclude"' +
        ' xmlns:xlink="http://www.w3.org/1999/xlink" version="5.0"' +
        ' xml:id="section-' + title + '">\n' +
        '<title>Available Check Types and Fields</title>\n';

  for (key in checkTypes) {
    if (checkTypes.hasOwnProperty(key)) {
      ct = checkTypes[key];
      fields = sortCtFields(ct.definition);
      len = fields.length;

      str += sprintf('<section xml:id="section-check-types-%s">', ct.name);
      str += sprintf('<title>%s</title>', ct.name);

      if (len > 0) {
        str = str + '<informaltable rules ="all">\n';
        str = str + '<thead>\n';
        str = str + '<tr><td>Field</td><td>Description</td><td>Validation</td></tr>\n';
        str = str + '</thead>\n';
        str = str + '<tbody>';

        fields.forEach(function(field) {
          str = str + generateLine(field.name, field.desc, field.val);
        });

        str = str + '</tbody></informaltable>\n';
      }
      else {
        str += '<para>none</para>';
      }
      if (ct.description) {
        str += sprintf('<para>%s</para>', ct.description);
      }
      str += '<xi:include href="' + key + '.xml"><xi:fallback></xi:fallback></xi:include>\n';
      str += '</section>';
    }
  }

  str = str + '</section>';
  fs.writeFileSync(filename, str);
}


function writeNoDetails(title, filename) {
  var str;
  str = '<?xml version="1.0" encoding="UTF-8"?>' +
        '<section xmlns="http://docbook.org/ns/docbook"' +
        ' xmlns:xi="http://www.w3.org/2001/XInclude"' +
        ' xmlns:xlink="http://www.w3.org/1999/xlink" version="5.0"' +
        ' xml:id="section-' + title + '">\n' +
        '<title>No Attributes</title>\n' +
        '<para>There are no particular attributes about this element</para>' +
        '</section>';
  fs.writeFileSync(filename, str);
}


function processDefs() {
  var prefix = path.join(__dirname + '/src/docbkx/partials/'), i, len, def, fields, field, nonAgentChecks;

  if (argv.a) {
    checkTypes = CHECK_TYPES;
    reverseCheckTypes = CHECK_TYPES_REVERSE;
  } else {
    checkTypes = REMOTE_CHECK_TYPES;
    reverseCheckTypes = REMOTE_CHECK_TYPES_REVERSE;
  }

  if (!path.existsSync(prefix)) {
    fs.mkdirSync(prefix, 0777);
  }

  for (i = 0, len = dbu.def.length; i < len; i++) {
    def = dbu.def[i];
    generateDefFragment(def, def.name, prefix + 'swiz-' + def.name + '.xml');
  }

  var key;
  for(key in messengers) {
    if (messengers.hasOwnProperty(key)) {
      var fname = prefix + 'swiz-mes-' + key + '.xml';
      if (messengers[key].DETAILS_DEFINITION.fields.length === 0) {
        writeNoDetails(key, fname);
      } else {
        generateMessenger(messengers[key].DETAILS_DEFINITION.fields, key, fname);
      }
    }
  }

  generateCheckTypesFragment(checkTypes, 'available-check-types-and-fields', prefix + 'swiz-available-check_types.xml');
  generateCheckListFragment(checkTypes, 'available-check-types', prefix + 'swiz-list-available-check_types.xml');
}


processDefs();
