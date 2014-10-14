var request = require('request'),
    cheerio = require('cheerio'),
    fs = require("fs"),
    mkdirp = require("mkdirp"),
    Download = require("download"),
    progress = require('download-status'),
    path = require('path');

var j = request.jar()
request = request.defaults({jar:j});

request.post('http://www.devmedia.com.br/login/login.asp', {form:{
  usuario: "everton.ope@jspecas.com.br",
  senha: "jsvwjsvw",
  ac: 1
}},function(err, response) {
  process.argv.slice(2).forEach(function(url) {
    var dir = url.match(/\/curso\/(.*?\/)/)[1];
    dir = path.join(__dirname,'downloads',dir);	
    
    mkdirp(dir, function(err) {

      console.log("Lendo arquivos de", url);
      request.get(url, function(err, response, body){
        var $ = cheerio.load(body), links;
      	links = $('a[href^="http://www.devmedia.com.br/download/down.asp?id="]')
        .get();
	links.forEach(function(url, i) {
           var $url = $(url);

	   request.head($url.attr("href"), function(err, response) {
	     var urlFile = response.request.uri.href;

             (new Download()
	     .use(progress()))
	     .get(urlFile).dest(dir).run(function(err) {
		console.log("\n\n");
	     	if (err)
		   console.log("Erro ao tentar baixar", path.basename(urlFile));
		else
		   console.log(path.basename(urlFile), "baixado com sucesso");

		console.log("\n\n");
	     });
	   });
	});

	console.log("\n\n");
	console.log(links.length, "arquivos encontrados");
	console.log("\n\n");

      });
    });
  });
});

