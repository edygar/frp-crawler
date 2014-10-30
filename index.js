"use strict";
/* jshint node: true */

var Rx = require('rx'),
    request = require('request'),
    mkdirp = require('mkdirp'),
    FileQueue = require('filequeue'),
    path = require('path');

var fs = new FileQueue(1000), observableRequest, observableMkdirp;
var downloadStatus = {};

request = request.defaults({jar:request.jar()});
observableRequest = Rx.Observable.fromNodeCallback(request);
observableMkdirp = Rx.Observable.fromNodeCallback(mkdirp);

// Autentica utilizando as credenciais
var report = observableRequest({
  uri: 'http://www.devmedia.com.br/login/login.asp',
  method: 'post',
  form:{
    usuario: "everton.ope@jspecas.com.br",
    senha: "jsvwjsvw",
    ac: 1
  }
})

// Para cada URL informada
.combineLatest(Rx.Observable.fromArray(process.argv.slice(2)), function(auth, url) {
  return url;
})

// requisita a página
.flatMap(function(url) {
  var dir = url.match(/\/curso\/(.*?\/)/)[1];
  dir = path.join(__dirname,'downloads',dir); 

  return observableMkdirp(dir)
  .flatMap(function() {
    return observableRequest(url);
  })
  // Encontra todos os links a serem baixados
  // projeta cada link individualmente na sequência
  .flatMap(function(response){ 
    return Rx.Observable.fromArray(response[1].match(/http:\/\/www.devmedia.com.br\/download\/down.asp\?id=([^"']+)/g));
  })
  // requisita primeiro a url final do arquivo (depois dos redirecionamentos)
  .flatMap(function(fileUrl) {
    return observableRequest({
      uri: fileUrl,
      method: 'head'
    })
    .flatMap(function(response){
      var filename = path.join(dir, path.basename(response[0].request.uri.href));
      return Rx.Observable.create(function(observer) {
        var filesize = parseInt(response[0].headers['content-length'],10);
        var report = {
          filename: filename,
          total: filesize,
          downloaded: 0
        };

        observer.onNext({
          filename: filename,
          total: filesize,
          downloaded: 0
        });

        request(fileUrl,function(err) {
          if (err) {
            console.log("ERROR", err);
          }
        })
        .on('data', function(data) {
          report.downloaded += data.length;
          observer.onNext(report);
        })
        .on('error', observer.onError.bind(observer))
        .on('close', observer.onCompleted.bind(observer))
        .pipe(fs.createWriteStream(filename));
      });
    });
  });
})
.subscribe(function(update) {
  downloadStatus[update.filename] = update;
});

Rx.Observable.interval(2000).subscribe(function() {
  var totalPercent = 0,
      files = Object.keys(downloadStatus);

  files.forEach(function(filename) {
    var progress = downloadStatus[filename],
        percent = (100.0 * progress.downloaded / progress.total);
    totalPercent += percent;
    console.log(path.basename(filename) + " | Downloaded: " + percent + "% (" + progress.downloaded + " de " + progress.total + ")");
  });

  totalPercent /= 100 * files.length;
  console.log('------------');
  console.log('Total: ' + totalPercent);
  console.log('------------');

  if (totalPercent >= 100) {
    process.exit();
  }
});