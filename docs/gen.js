var pathSetup = require('../lib/util/path_setup').pathSetup;

pathSetup();

var Showdown = require('showdown').Showdown;
var jade = require('jade');
var sys = require('util');
var fs = require('fs');
var path = require('path');
var swiz = require('swiz');
var help = swiz.help;
var dbu = require('../lib/api/defs');

var converter = new Showdown.converter();
var style = fs.readFileSync("docs/assets/style.css");

process.stdin.resume();

/* Pulled straight from
 * node doctools, thank you ryan for helping
 * us generate a Toc for our awesome node program
 * you da best. Documented in the README.md
 */
function formatIdString(str) {
  str = str.toLowerCase()
    .replace(/[^A-Za-z0-9_.]+/gmi, "");

  return str.substr(0,1).toLowerCase() + str.substr(1);
}

function generateToc(data) {
  var last_level = 0
    , first_level = 0
    , toc = [
      '<div id="toc">',
      '<h2>Table Of Contents</h2>'
    ];

  data.replace(/(^#+)\W+([^$\n]+)/gmi, function(src, level, text) {
    level = level.length;

    if (first_level == 0) first_level = level;

    if (level <= last_level) {
      toc.push("</li>");
    }

    if (level > last_level) {
      toc.push("<ul>");
    } else if (level < last_level) {
      for(var c=last_level-level; 0 < c ; c-- ) {
        toc.push("</ul>");
        toc.push("</li>");
      }
    }

    toc.push("<li>");
    toc.push('<a href="#'+formatIdString(text)+'">'+text+'</a>');

    last_level = level;
  });

  for(var c=last_level-first_level; 0 <= c ; c-- ) {
    toc.push("</li>");
    toc.push("</ul>");
  }

  toc.push("<hr />")
  toc.push("</div>");

  return toc.join("");
}

var includeExpr = /^@include\s+([A-Za-z0-9-_\/]+)(?:\.)?([a-zA-Z]*)$/gmi;
// Allow including other pages in the data.
function loadIncludes(data) {
  return data.replace(includeExpr, function(src, name, ext) {
    try {
      var include_path = path.join(__dirname, name+"."+(ext || "md"));
      return loadIncludes(fs.readFileSync(include_path, "utf8"));
    } catch(e) {
      return "";
    }
  });
}

function expandValidators(body) {
  var matches = body.match(/\w*?::valve::.*/gi), html, tmpl, object_type;

  if (!matches) {
    return body;
  }

  tmpl = fs.readFileSync('docs/assets/valve.jade');

  for (i=0; i < matches.length; i++) {
    object_type = matches[i].replace('::valve::', '');
    // Fetch the help object from the valve library
    obj = help(dbu.validity[object_type]);
    // render the help object to HTML
    html = jade.render(tmpl, { locals: { object: obj } });
    // Replace the body with the generated html
    body = body.replace(matches[i], html);
  }

  return body;
};

function expandFixtures(body) {
  var matches = body.match(/\w*?::fixture::.*/gi), html, tmpl, object_type, match;

  if (!matches) {
    return body;
  }

  //tmpl = fs.readFileSync('docs/assets/fixture.jade');

  for (i=0; i < matches.length; i++) {
    var fixture,
        dataset,
        name, 
        serialization,
        result;

    // fixture dataset name format(optional)
    match = matches[i].match(/::fixture::([^:]*)::([^:]*):?:?([^:]*):?:?(.*)/);
    fixture = match[1];
    dataset = match[2];
    name = match[3];
    serialization = (match[4] === '' || match[4].toLowerCase() == 'json') ? swiz.SERIALIZATION.SERIALIZATION_JSON : swiz.SERIALIZATION.SERIALIZATION_XML;

    // Do the conversion
    result = getFixture(fixture, dataset, name, serialization);

    // Replace the body with the generated html
    body = body.replace(matches[i], result);
  }
  return body;
};

function getFixture(fixture, dataset, name, serialization) {
  var loader,
      result;

  // Load the actual fixture
  loader = require("../tests/fixtures/" + fixture);
  if (!loader) {
    throw new Error("Unable to find fixture named " + fixture);
  }

  result = loader.fixture.fetchMessage(dataset, name, serialization);
  return result
}

process.stdin.on('data', function(chunk) {
  var body = loadIncludes(chunk.toString()),
      toc;

  body = expandValidators(body);
  body = expandFixtures(body);
  toc = generateToc(body);
  body = converter.makeHtml(body);

  jade.renderFile('docs/assets/template.jade', { locals: { body: body, style: style, toc: toc } }, function(err, html){
    if (err) {
      process.exit(1);
    }
    process.stdout.write(html);
  });
});
