/*global require, Promise, console, process*/
/*jshint esnext:true, noyield:true */
'use strict';

var app = require('koa')();
var router = require('koa-router')({prefix: '/api/v1'});
var koaBody = require('koa-body')();
var cors = require('koa-cors');
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
            client.query('SELECT * FROM registers', function(err, result) {
                var response = {"registers": result &&result.rows};
                if (err) {
                    reject(err);
                } else {
                    resolve(response);
                }
                done();
            });
        });
    });
};

var getRegister = function *(id) {
    return new Promise(function(resolve, reject) {
        pg.connect(process.env.DATABASE_URL, function(err, client, done) {
            client.query('SELECT row FROM registers WHERE id=$1', [id], function(error, result) {
                console.log(error, result);
                var response = {"register": result && result.rows[0]};
                if (err) {
                    reject(err);
                } else {
                    resolve(response);
                }
                done();
            });
        });
    });
};

var createRegister = function *(register) {
    return new Promise(function(resolve, reject) {
        pg.connect(process.env.DATABASE_URL, function(err, client, done) {
            client.query("INSERT INTO registers(register, date, label) VALUES($1, $2, $3) RETURNING id", [register.register, register.date, register.label], function(err, result) {
                if (err) {
                    reject(err);
                } else {
                    resolve(result && result.rows[0] && result.rows[0].id);
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
    var register = this.request.body.register;
    var id = yield createRegister(register);
    var requestBody = this.request.body;
    this.status = 201;
    this.body = {
        register: {
            id: id,
            register: register.register,
            date: register.date,
            label: register.label
        }
    };
});

router.get('/registers/:id', function *() {
    console.log(this.params);
    this.body = yield getRegister(this.params.id);
    this.status = 200;
});
app.use(cors({origin: "*"}));
app.use(router.routes());
app.use(router.allowedMethods());

app.listen(process.env.PORT || '8080');
