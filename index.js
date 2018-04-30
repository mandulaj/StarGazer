const scrapeIt = require("scrape-it")
var express    = require('express');        // call express
var app        = express();                 // define our app using express
var bodyParser = require('body-parser');
var http = require('http');
var twilio = require('twilio');

var accountSid = 'ACc43c6816b1ac79da59a53f8a1725c67d'; // Your Account SID from www.twilio.com/console
var authToken = '9df7baeec9d2ebef8611a6c6460d38d2';


var client = new twilio(accountSid, authToken);



var options = {
  host: 'http://10.42.0.108'
};

var urlcache = {
  "mercury": "https://in-the-sky.org//data/object.php?id=P1",
  "venus": "https://in-the-sky.org//data/object.php?id=P2",
  "mars": "https://in-the-sky.org//data/object.php?id=P4",
  "jupiter": "https://in-the-sky.org//data/object.php?id=P5",
  "saturn":"https://in-the-sky.org//data/object.php?id=P6",
  "uranus":"https://in-the-sky.org//data/object.php?id=P7",
  "neptun":"https://in-the-sky.org//data/object.php?id=P8",
  "pluto":"https://in-the-sky.org/data/object.php?id=A134340",
  "sun": "https://in-the-sky.org//data/object.php?id=1",
  "son": "https://in-the-sky.org//data/object.php?id=1",
  "moon":"https://in-the-sky.org//data/object.php?id=P301"
}

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var port = process.env.PORT || 8080;        // set our port

// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();              // get an instance of the express Router

// test route to make sure everything is working (accessed at GET http://localhost:8080/api)
router.get('/', function(req, res) {
  
    console.log(req)
    res.json({ message: 'hooray! welcome to our api!' });   
});


router.post('/set', (req, res)=> {

  
})

// more routes for our API will happen here

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);




setInterval(function(){
  http.get("http://corbeanca-nor.ddns.net/celestialIndicator/return_object.php", function(res){
    var body = '';

    res.on('data', function(chunk){
        body += chunk;
    });

    res.on('end', function(){
        var fbResponse = JSON.parse(body);
        
        console.log(fbResponse);
        var data = fbResponse;
        var time = new Date();
       
       var planet  = data["object"].toLowerCase();
       if(planet == "stop" || planet =="Stop" || planet== "STOP"){
         sendToESP({alt:-90, az: 0, laser: 0});
         return;
       }
       
       if(typeof urlcache[planet] === "string"){
         scrapeObject(urlcache[planet], (err, {data})=>{
           sendToESP(data, (err)=>{
             //res.json(data);
           });
         });
       } else {
         // Promise interface
         scrapeIt("https://in-the-sky.org/search.php?s="+ planet + "&searchtype=Objects", {
             link: {
               selector: ".mainpane table tbody td:first-child a",
               attr: "href"
             }
         }, (err,  {data}) => {
           urlcache[planet] = data.link;
           scrapeObject(data.link, (err, {data})=>{
             sendToESP(data, (err)=>{
               //res.json(data);
               
             })
           });
         });
       }
    
    
    });
    
  })
},1000);



function scrapeObject(url, cb){
  scrapeIt(url, {
    ra: "table.objinfo tr"
  }, (err, {data}) => {
    //console.log(data.ra)
    
    var raM = /Right Ascension:((\-|\+)?\d+)h(\d+)m/g.exec(data.ra)
    var decM = /Declination:((\-|\+)?\d+)°(\d+)'/g.exec(data.ra)
    
    var ra = (parseInt(raM[1]) + parseInt(raM[3])/60) * 15;
    var dec = Math.sign(parseInt(decM[1])) * (Math.abs(parseInt(decM[1])) + parseInt(decM[3])/60);  
    
    
    data = getAltAzim({lat:53.4808, long:2.2426}, new Date(), ra, dec);
    console.log(ra, dec, data)
    
    cb(null, {data});
  });
}


function sendToESP(data, cb){
  var laser = 1;
  if(typeof data.laser != "undefined" ){
    laser = data.laser
  }
  http.get(options.host+"/azim=" + Math.floor(data.az) + "&alt=" + Math.floor(data.alt) + "&laser=" + laser, cb);
}






function proper_ang(big) {
    with (Math) {
        var tmp = 0;
        if (big > 0) {
            tmp = big / 360.0;
            tmp = (tmp - floor(tmp)) * 360.0;
        } else {
            tmp = ceil(abs(big / 360.0));
            tmp = big + tmp * 360.0;
        }
    }
    return tmp;
}

function proper_ang_rad(big) {
    with (Math) {
        var tmp = 0;
        if (big > 0) {
            tmp = big / 2 / PI;
            tmp = (tmp - floor(tmp)) * 2 * PI;
        } else {
            tmp = ceil(abs(big / 2 / PI));
            tmp = big + tmp * 2 * PI;
        }
    }
    return tmp;
}

function julian_date(time) {
    var mm, dd, yy;
    var yyy, mmm, a, b;



    dd = time.getDate();
    mm = time.getMonth() + 1; 
    yy = time.getFullYear();

    with (Math) {
        var yyy = yy;
        var mmm = mm;
        if (mm < 3) {
            yyy = yy - 1;
            mmm = mm + 12;
        }
        a = floor(yyy / 100);
        b = 2 - a + floor(a / 4);

        return floor(365.25 * yyy) + floor(30.6001 * (mmm + 1)) + dd + 1720994.5 + b;
    }
}

function getAltAzim(coord, time, ra, dec){
  var lat, lng, t0, gt, st, alt, az, hour_ang;
  with (Math){
    
    var RAD = 180 / PI;
    
    lat = coord.lat / RAD;
    lng = coord.long / RAD;
    
    ra  = ra/ RAD;
    dec = dec /RAD;
    
    t0 = (julian_date(time) - 2415020.0) / 36525;
    gt = 0.276919398 + 100.0021359 * t0 + 1.075E-6 * pow(t0, 2);
    st = proper_ang_rad((gt - floor(gt)) * 2 * PI + (time.getUTCHours() + time.getUTCMinutes() / 60) * 0.26251617);
    
    hour_ang = proper_ang_rad(st - lng - ra);
    alt = asin(sin(dec) * sin(lat) + cos(dec) * cos(lat) * cos(hour_ang));
    az = acos((sin(dec) - sin(lat) * sin(alt)) / (cos(lat) * cos(alt)));
    if (sin(hour_ang) >= 0)
        az = 2 * PI - az;
    
    alt = alt * RAD;
    az = az * RAD;
    
    return {alt, az};
    
  }
}



// START THE SERVER
// =============================================================================
app.listen(port);
console.log('Magic happens on port ' + port);
