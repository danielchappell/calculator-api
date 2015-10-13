/*global require, Promise, console, process*/
/*jshint esnext:true, noyield:true */
'use strict';

var app = require('koa')();
var Router = require('koa-router');
var koaBody = require('koa-body')();
var session = require('koa-generic-session');
app.use(session());
app.keys = ['ember-calc'];

var passport = require('koa-passport');
var LocalStrategy = require('passport-local').Strategy;
var cors = require('koa-cors');
app.use(cors({origin: "*"}));


var bcrypt = require('bcrypt');
var pg = require('pg');




var generatePasswordHash = function* (password) {
    return new Promise(function (resolve, reject) {
        bcrypt.genSalt(10, function(err, salt) {
            bcrypt.hash(password, salt, function(err, hash) {
                if(err) {
                    reject(err);
                } else {
                    resolve(hash);
                }
            });
        });
    });
};

var verifyPassword = function* (password, hash, id) {
    return new Promise(function(resolve, reject) {
        bcrypt.compare(password, hash, function(err, didMatch) {
            if (err) {
                reject(err);
            } else {
                resolve(didMatch ? id : false);
            }
        });
    });
};


var createUser = function* (username, password) {
    var hashedPassword = yield generatePasswordHash(password);
    return new Promise(function (resolve, reject) {
        pg.connect(process.env.DATABASE_URL, function(err, client, done) {
            client.query('INSERT INTO users(username, password) VALUES($1, $2) RETURNING id', [username, hashedPassword], function(err, result) {
                if (err) {
                    reject(err);
                } else {
                    resolve(result.rows[0] && result.rows[0].id);
                }
                done();
            });
        });
    });
};

var loginUser = function (username, password) {
    return new Promise(function(resolve, reject) {
        pg.connect(process.env.DATABASE_URL, function(err, client, done) {
            client.query('SELECT password, id FROM users WHERE username=$1', [username], function(err, result) {
                if(err) {
                    reject(err);
                } else {
                    resolve(password, result.rows[0].password, result.rows[0].id);
                }
                done();
            });
        });
    }).then(verifyPassword);
};


var checkSession = function* (next) {
    if (this.req.isAuthenticated()) {
        yield next;
    } else {
        this.status = 401;
    }
};

var allRegisters = function* (userId) {
    return new  Promise(function(resolve, reject) {
        pg.connect(process.env.DATABASE_URL, function(err, client, done) {
            client.query('SELECT * FROM registers WHERE userId=$1',[userId], function(err, result) {
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

var getRegister = function* (userId, id) {
    return new Promise(function(resolve, reject) {
        pg.connect(process.env.DATABASE_URL, function(err, client, done) {
            client.query('SELECT * FROM registers WHERE id=$1 AND userId=$2', [id, userId], function(error, result) {
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

var createRegister = function* (userId, register) {
    return new Promise(function(resolve, reject) {
        pg.connect(process.env.DATABASE_URL, function(err, client, done) {
            client.query("INSERT INTO registers(register, date, label, userId) VALUES($1, $2, $3, $4) RETURNING id", [register.register, register.date, register.label, userId], function(err, result) {
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


var publicRouter = new Router({prefix: '/api/v1'});
var authenticatedRouter = new Router({prefix: '/api/v1'});

publicRouter.post('/users', koaBody, function* () {
    var user = this.request.body.user;
    var userId = yield createUser(user.username, user.password);
    this.status = 201;
    yield this.login(userId);
});

publicRouter.post('/login', koaBody, function* (next) {
    var ctx = this;
    yield passport.authenticate('local', function* (err, user, info) {
        if (err) {
            throw err;
        }
        console.log("context", ctx);
        console.log(ctx.response.status);
        console.log(user);
        if (user === false) {
            ctx.response.status = 401;
            ctx.response.body = {success: false};
        } else {
            yield ctx.login(user);
            this.response.status = 200;
        }
    };
});

authenticatedRouter.get('/registers', function* () {
    this.body = yield allRegisters(this.req.user);
    this.status = 200;
});

authenticatedRouter.post('/registers', koaBody, function* () {
    var register = this.request.body.register;
    var id = yield createRegister(this.req.user, register);
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

authenticatedRouter.get('/registers/:id', function* () {
    this.body = yield getRegister(this.req.user, this.params.id);
    this.status = 200;
});

authenticatedRouter.post('/logout', function* () {
    this.logout();
    this.status = 200;
});

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});

passport.use(new LocalStrategy(function(username, password, done) {
    loginUser(username, password).then(function(userId) {
        done(null, userId);
    });
}));

app.use(passport.initialize());
app.use(passport.session());


app.use(publicRouter.routes());
app.use(publicRouter.allowedMethods());
//hit authentication function before proccessing requests
app.use(checkSession);
app.use(authenticatedRouter.routes());
app.use(authenticatedRouter.allowedMethods());

pg.connect(process.env.DATABASE_URL, function(err, client, done) {
    if (err) {
        throw err;
    }

    client.query('CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY, username VARCHAR(30), password VARCHAR(100))', function(err) {
        console.log(err);
        done();
    });

    client.query('CREATE TABLE IF NOT EXISTS registers(id SERIAL PRIMARY KEY, register VARCHAR(1000), date VARCHAR(50), label VARCHAR(30), userId INTEGER REFERENCES users (id))', function(err) {
        console.log(err);
        done();
    });


});


app.listen(process.env.PORT || '8080');
