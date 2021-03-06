'use strict';

var proxy = require('express-http-proxy');
var express = require('express');
var logger = require('log4js').getLogger('server');
var app = express();
var path = require('path');
var fs = require('fs');
var _ = require('lodash');

app.use(function findFile(req, res, next) {
    var withQuery = path.join(__dirname, '../data', req.url.substring(1));
    var withoutQuery = path.join(__dirname, '../data', req.path.substring(1));

    var options = [
        withQuery,
        withQuery + '.json',
        withoutQuery,
        withoutQuery + '.json'
    ];

    var file = _.find(options, function (o) {
        return fs.existsSync(o) && fs.lstatSync(o).isFile();
    });

    logger.info('file is', file);

    if (!!file) {
        var result = JSON.parse(fs.readFileSync(file));
        if (result.error > 0) {
            res.status(result.error).send(result.content);
        } else {
            res.send(result);
        }

    } else {
        next();
    }
});

var endpointString = process.env.CFY_ENDPOINT || 'http://10.10.1.10/'; // no need for /api/v2/, this will come as part of the backend's request from meConf.js
if (endpointString[endpointString.length - 1] !== '/') {
    endpointString = endpointString + '/'; // must end with slash;
}
var endpoint = require('url').parse(endpointString);
logger.info('expecting to find cloudify rest at [', endpoint.href, ']');
app.use(function proxyRequestToCloudify(req, res, next) {
    try {
        proxy(endpoint.host, {
            forwardPath: function (req) {
                var fPath = require('url').resolve(endpoint.path, require('url').parse(req.url).path.substring(1));
                logger.info('this is forward path', fPath);
                return fPath;
            }
        })(req, res, next);
    } catch (e) {
        logger.error('unable to proxy', e);
        next(e);
    }
});

app.use(function error(errorObj, req, res/*, next */) {
    logger.error(errorObj);
    res.status(500).send({'key': 'proxy_error', stack: errorObj.stack.split('\n'), reason: errorObj.toString()});
});

var server = app.listen(3333, function () {
    var host = server.address().address;
    var port = server.address().port;

    logger.info('Example app listening at http://%s:%s', host, port);
});
