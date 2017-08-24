var fs = require('fs');
var lazy = require("lazy");
var http = require('http');
var xml2js = require('xml2js'), builder = new xml2js.Builder();
var xpath = require("xml2js-xpath");

var m3u_path = "list.m3u";
var xml_path = "guide.xml";

var cats = JSON.parse(fs.readFileSync("cats.json"));
var chls = JSON.parse(fs.readFileSync("chls.json"));

epg_ids = {
    "BBC 1":69387
,   "BBC 2":50059
,   "BBC 3":50059
,   "BBC 4":83282
}

categories = {
  "NEWS":"NEWS"
  //ANIMAL_WILDLIFE
, "ANIMAL PLANET":"ANIMAL_WILDLIFE"
  //ARTS
, "BRAVO":"ARTS"
  //COMEDY
, "COMEDY":"COMEDY"
  //EDUCATION
, "DISCOVERY":"EDUCATION"
  //ENTERTAINMENT
, "TLC":"ENTERTAINMENT"
  //FAMILY_KIDS
, "FAMILY":"FAMILY_KIDS"
  //LIFE_STYLE
, "LIFETIME":"LIFE_STYLE"
  //NEWS
, "CBC NEWS":"NEWS"
  //PREMIER
, "HBO EAST":"PREMIER"
  //TECH_SCIENCE
, "DISCOVERY SCIENCE":"TECH_SCIENCE"
  //MOVIES
, "CINEMAX EAST":"MOVIES"
  //SPORTS
  //DRAMA
}

logos = {
    "CBC NEWS" : "http://www.lyngsat-logo.com/hires/cc/cbc_news_network.png"
}

var xml_json = {};

str = "";
fav_str = "";
// Get all the available channels
num = 0;
new lazy(fs.createReadStream(m3u_path))
     .lines
     .forEach(function(line){
       line = line.toString();
        if (line.indexOf('#EXTINF') >= 0){
            name = line.replace(/^.+tvg-id="/, '').replace(/".*/, '');
            cat = line.replace(/^.+group-title="/, '').replace(/".*/, '');
            if (!chls[name] && cat != "Favourites") { chls[name] = {}; chls[name]['cat'] = cat; }
        } else if (line.indexOf('http') >= 0 && cat != "Favourites") {
            url = line;
            chls[name]['url'] = url;
        }

     }
);


setTimeout(function(){
console.log('Started XMLTV Read..');
numb = cats.length + 1;
var parser = new xml2js.Parser();
fs.readFile(xml_path, function(err, data) {
    parser.parseString(data, function (err, json) {

        for (key in json['tv']['channel']) {
          ch_name = json['tv']['channel'][key]['$']['id'];
          display_name = ' ';
          for (name in epg_ids){
            if(epg_ids[name] == ch_name){ display_name = name; }
          }
          if (ch_name in chls) {
            ch_cat = chls[ch_name]['cat'];
            delete json['tv']['channel'][key]['url'];
            delete json['tv']['channel'][key]['icon']; // add own later
            delete json['tv']['channel'][key]['display-name'];
            json['tv']['channel'][key]['display-name'] = {};
            json['tv']['channel'][key]['display-name']['_'] = display_name;
            //json['tv']['channel'][key]['display-name']['$'] = {};
            //json['tv']['channel'][key]['display-name']['$']['lang'] = 'en';
            //json['tv']['channel'][key]['$']['repeat-programs'] = 'true';
            json['tv']['channel'][key]['icon'] = {}
            json['tv']['channel'][key]['icon']['$'] = {}
            json['tv']['channel'][key]['display-number'] = {}
            if (!(ch_cat in cats)) {
              cats[ch_cat] = {};
              cats[ch_cat]['cat_num'] =  numb;
              cats[ch_cat]['num_chls'] = 1;
              numb++;
            }
            if (chls[ch_name]['num']) {
                json['tv']['channel'][key]['display-number']['_'] = cats[ch_cat]['cat_num'] +'-'+ chls[ch_name]['num'];
            } else {
                json['tv']['channel'][key]['display-number']['_'] = cats[ch_cat]['cat_num'] +'-'+ cats[ch_cat]['num_chls'];
                chls[ch_name]['num'] = cats[ch_cat]['num_chls'];
                cats[ch_cat]['num_chls']++;
            }
          } else {
            delete json['tv']['channel'][key];
          }
        }
        for (key in json['tv']['programme']) {
          ch_name = json['tv']['programme'][key]['$']['channel'];
          display_name = ' ';
          for (name in epg_ids){
            if(epg_ids[name] == ch_name){ display_name = name; }
          }
          if (ch_name in chls){
            start = parseInt(json['tv']['programme'][key]['$']['start']); //.replace(' +0000',''))+40000;
            stop = parseInt(json['tv']['programme'][key]['$']['stop']); //.replace(' +0000',''))+40000;
            json['tv']['programme'][key]['$']['start'] = start + " +0000";
            json['tv']['programme'][key]['$']['stop'] = stop + " +0000";
            json['tv']['programme'][key]['category'] = {};
            ch_genre = '';
            temp_ch_name = ch_name.replace(/\s*(CA|UK|USA)\s*/g, '');
            if (temp_ch_name in categories) {
              json['tv']['programme'][key]['category']['_'] = categories[temp_ch_name].toUpperCase();
              ch_genre = categories[temp_ch_name].toUpperCase();
            } else {
                found = false;
                //console.log(display_name);
                for (var ch_key in categories){
                    if (display_name.indexOf(ch_key) != -1){
                        json['tv']['programme'][key]['category']['_'] = categories[ch_key].toUpperCase();
                        //console.log("Found "+ch_key);
                        found = true; break;
                    }
                }
                if (found == false){
                    json['tv']['programme'][key]['category']['_'] = chls[ch_name]['cat'].toUpperCase();
                }
            }
            json['tv']['programme'][key]['$']['video-src'] = chls[ch_name]['url'];
            json['tv']['programme'][key]['$']['video-type'] = "HLS";
            if(!json['tv']['programme'][key]['icon']){
                json['tv']['programme'][key]['icon'] = {};
                json['tv']['programme'][key]['icon']['$'] = {};
                if (display_name in logos) {
                    json['tv']['programme'][key]['icon']['$']['src'] = 'https://yourdomainhere.com/thumb.php?src='+logos[display_name]+'&h=200&w=350&zc=2&q=100&ct=0'; //&ct=0&cc=ffffff
                } else {
                    json['tv']['programme'][key]['icon']['$']['src'] = ' ';
                }
            }
            json['tv']['programme'][key]['rating'] = {};
            json['tv']['programme'][key]['rating']['$'] = {};
            json['tv']['programme'][key]['rating']['$']['system'] = 'com.android.tv';
            json['tv']['programme'][key]['rating']['value'] = {};
            if (ch_genre == "FAMILY_KIDS") {
              json['tv']['programme'][key]['rating']['value']['_'] = 'com.android.tv/US_TV/US_TV_G';
            } else {
              json['tv']['programme'][key]['rating']['value']['_'] = 'com.android.tv/US_TV/US_TV_PG';
            }
          } else {
            delete json['tv']['programme'][key];
          }
        }

        xml_json = json;
        console.log('Done.');
        
        fs.writeFile('cats.json', JSON.stringify(cats), function(err) {
            if(err) { return console.log(err); }
            console.log("Categories saved!");
        });
        
        fs.writeFile('chls.json', JSON.stringify(chls), function(err) {
            if(err) { return console.log(err); }
            console.log("Channels saved!");
        });
        
        
    });
});

}, 4000); // run after 2 sec


// Start HTTP Server
var server = http.createServer(function(req, response) {
    req_proto = req.headers['x-forwarded-proto'] || 'http';
    user = '';
    user_pass = '';
    if (req.headers['authorization']) {
        auth = req.headers['authorization'].replace('Basic ','');
        user = new Buffer(auth, 'base64').toString('utf8').replace(/\:.*/,'').toUpperCase()+'\t';
        user_pass = new Buffer(auth, 'base64').toString('utf8')+'@';
    }
      console.log(user+"Path: " + req.url);
      console.log(req.headers);
      xml_json_new = JSON.parse( JSON.stringify(xml_json).replace(/https\:\/\/yourdomainhere\.com/g, req_proto+'://'+user_pass+req.headers['x-forwarded-host']) );
      xml = builder.buildObject(xml_json);
      response.writeHead(200, {"Content-Type": "application/xml"});
      response.write(xml);
      response.end();

  });

  console.log("Server listening on port 5400");
  server.listen(5400);
