var fs = require('fs');

var type = {
  'i': 'Int32',
  'I': 'Uint32',
  'l': 'Int64',
  'L': 'Uint64',
  'n': 'Double',
  's': 'String'
};

function buildMetricsTable(fn, title, obj) {
  var i;
  var str = '<?xml version="1.0" encoding="UTF-8"?>' +
        '<section xmlns="http://docbook.org/ns/docbook"' +
        ' xmlns:xi="http://www.w3.org/2001/XInclude"' +
        ' xmlns:xlink="http://www.w3.org/1999/xlink" version="5.0"' +
        ' xml:id="section-' + title + '">\n' +
        '<title>standard metrics</title>\n' +
        '<para>';
  str = str + '<informaltable rules ="all">\n';
  str = str + '<thead>\n';
  str = str + '<tr><td>Metric</td><td>Description</td><td>Type</td></tr>\n';
  str = str + '</thead>\n';
  str = str + '<tbody>\n';
  for (i in obj.metrics) {
    var elem = obj.metrics[i];
    if (!descriptions[i]) {
      console.error('Missing description for ' + i);
      process.exit(2);
    }
    str +=  '<tr><td><command>' + i + '</command></td><td>' + descriptions[i];
    if (elem.type == 's') {
      elem.data = '"' + elem.data + '"';
    }
    str +=  ' (ex: <![CDATA[' + elem.data + ']]>)' + 
            '</td><td>' + type[elem.type] + '</td></tr>\n';
  }

  str = str + '</tbody></informaltable>\n';
  str = str + '</para></section>';
  fs.writeFileSync(fn + title + '.xml', str, 'utf8');
}

var descriptions = JSON.parse(fs.readFileSync(__dirname + '/src/docbkx/metrics/metric-descriptions.json', 'utf8')),
    metricPth = __dirname + '/src/docbkx/metrics/',
    partialsPth = __dirname + '/src/docbkx/partials/',
    dirs = fs.readdirSync(metricPth),
    len = 'generated-',
    i, l;

for (i = 0; i < dirs.length; i++) {
  var dir;
  dir = dirs[i];
  if (dir.indexOf(len) === 0) {
    var json = JSON.parse(fs.readFileSync(metricPth + dir));
    buildMetricsTable(partialsPth, dir.substring(len.length, dir.length - '.json'.length), json);
  }
}
