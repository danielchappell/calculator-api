/*global require, Promise, console, process*/
/*jshint esnext:true, noyield:true */
'use strict';

var app = require('koa')();
var router = require('koa-router')({prefix: '/api/v1'});
var koaBody = require('koa-body')();
var pg = require('pg');

pg.connect(process.env.DATABASE_URL, function(err, client, done) {
    if (err) {
        throw err;
    }

    client.query('CREATE TABLE IF NOT EXISTS registers(id SERIAL PRIMARY KEY, register VARCHAR(1000), date VARCHAR(50), label VARCHAR(30))', function(err) {
        console.log(err);
        done();
    });
});

var allRegisters = function *() {
    return new  Promise(function(resolve, reject) {
        pg.connect(process.env.DATABASE_URL, function(err, client, done) {
            client.query('SELECT * FROM registers', function(err, rows) {
                resolve(rows);
                done();
            });
        });
    });
};

var getRegister = function *(id) {
    return new Promise(function(resolve, reject) {
        pg.connect(process.env.DATABASE_URL, function(err, client, done) {
            client.query('SELECT row FROM registers WHERE id=$1', [id], function(error, row) {
                resolve(row);
                done();
            });
        });
    });
};

var createRegister = function *(body) {
    return new Promise(function(resolve, reject) {
        pg.connect(process.env.DATABASE_URL, function(err, client, done) {
            client.query("INSERT INTO registers(register, date, label) VALUES($1, $2, $3)", [body.register, body.date, body.label], function(err, result) {
                if (err) {
                    reject(err);
                } else {
                    resolve(result[0].id);
                }
                done();
            });
        });
    });
};

router.get('/registers', function *() {
    this.body = yield allRegisters();
    this.status = 200;
});

router.post('/registers', koaBody, function *() {
    var id = yield createRegister(this.request.body);
    var requestBody = this.request.body;
    this.status = 201;
    this.body = {id: id,
                 register: requestBody.register,
                 date: requestBody.date,
                 label: requestBody.label};
});

router.get('/registers/:register_id', function *() {
    this.body = yield getRegister(this.params.register_id);
    this.status = 200;
});

app.use(router.routes());
app.use(router.allowedMethods());

app.listen(process.env.PORT || '8080');
