var faults = require('../lib/api/fault');
var fs = require('fs');

function writeCase(rootdir, niv, obj) {
  var list = 'Error Response Code(s): ', strs = [], key;
  for( key in niv) {
    if(niv.hasOwnProperty(key)) {
      strs.push(key + '(' + niv[key] + ')');
    }
  }
  for( key in obj) {
    if(obj.hasOwnProperty(key)) {
      strs.push(key + '(' + obj[key] + ')');
    }
  }
  list = list + strs.join(', ');
  console.log(list);
}

function processCases(rootdir, obj) {
  var tag, subtag;
  for (tag in obj.faults) {
    if (obj.faults.hasOwnProperty(tag)) {
      for (subtag in obj.faults[tag]) {
        if (obj.faults[tag].hasOwnProperty(subtag)) {
          writeCase(rootdir + tag + '-' + subtag, 
            obj.universalFaults,
            obj.faults[tag][subtag]);
        }
      }
    }
  }
}

function buildFaultTable(fn, obj) {
  var str = '<?xml version="1.0" encoding="UTF-8"?>' +
        '<section xmlns="http://docbook.org/ns/docbook"' +
        ' xmlns:xi="http://www.w3.org/2001/XInclude"' +
        ' xmlns:xlink="http://www.w3.org/1999/xlink" version="5.0"' +
        ' xml:id="section-faults">\n' +
        '<title>Fault and Error Code Descriptions</title>\n' +
        '<para>';
  str = str + '<informaltable rules ="all">\n';
  str = str + '<thead>\n';
  str = str + '<tr><td>Fault Element</td><td>Associated Error Codes</td><td>Description</td></tr>\n';
  str = str + '</thead>\n';
  str = str + '<tbody>\n';
  var elem;
  for (elem in obj.universalFaults) {
    if (obj.universalFaults.hasOwnProperty(elem)) {
      str = str + '<tr><td>' + elem + '</td><td><errorcode>' + obj.universalFaults[elem]
       + '</errorcode></td><td>' + obj.faultDescription[elem] + '</td></tr>\n'
    }
  }

  str = str + '</tbody></informaltable>\n';
  str = str + '</para></section>';
  fs.writeFileSync(fn, str, 'utf8');
}

var prefix = __dirname + '/src/docbkx/partials/';
buildFaultTable(prefix + 'faults.xml',faults.faultTable);
//processCases('/', faults.faultTable);
