'use strict';

var fs = require('fs');
var LB = require('os').EOL;
var minify = require('pg-minify');
var header = require('./db/header');
var promise = header.defPromise;
var options = {
    promiseLib: promise
};
var dbHeader = header(options);
var pgp = dbHeader.pgp;
var db = dbHeader.db;

var QueryFile = pgp.QueryFile;

var sqlSimple = './test/sql/simple.sql';
var sqlUsers = './test/sql/allUsers.sql';
var sqlUnknown = './test/sql/unknown.sql';
var sqlInvalid = './test/sql/invalid.sql';
var sqlTemp = './test/sql/temp.sql';

describe("QueryFile / Positive:", function () {

    describe("without options", function () {
        var qf = new QueryFile(sqlSimple);
        it("must not minify", function () {
            expect(qf.query).toBe("select 1; --comment");
        });
    });

    describe("with minify=true && debug=true", function () {
        var qf = new QueryFile(sqlUsers, {debug: true, minify: true});
        it("must return minified query", function () {
            expect(qf.query).toBe("select * from users");
        });
    });

    describe("non-minified query", function () {
        var result;
        beforeEach(function (done) {
            db.query(QueryFile(sqlUsers, {}))
                .then(function (data) {
                    result = data;
                    done();
                });
        });
        it("must resolve with data", function () {
            expect(result instanceof Array).toBe(true);
            expect(result.length > 0).toBe(true);
        });
    });

    describe("minified query", function () {
        var result;
        beforeEach(function (done) {
            db.query(QueryFile(sqlUsers, {minify: true}))
                .then(function (data) {
                    result = data;
                    done();
                });
        });
        it("must resolve with data", function () {
            expect(result instanceof Array).toBe(true);
            expect(result.length > 0).toBe(true);
        });
    });

    describe("property options", function () {
        var options = {
            debug: process.env.NODE_ENV === 'development',
            minify: false
        };
        Object.freeze(options);
        it("must be consistent with the settings", function () {
            expect(QueryFile(sqlSimple).options).toEqual(options);
        });
    });

    describe("inspect", function () {
        var qf = new QueryFile(sqlSimple);
        it("must return the query", function () {
            expect(qf.inspect()).toBe(qf.query);
        });
    });

    describe("modified file", function () {
        var q1 = "select 1";
        var q2 = "select 2";
        it("must be read again", function () {
            fs.writeFileSync(sqlTemp, q1);
            var qf = new QueryFile(sqlTemp, {debug: true});
            expect(qf.query).toBe(q1);
            expect(qf.error).toBeUndefined();

            fs.writeFileSync(sqlTemp, q2);
            var t = new Date();
            t.setTime(t.getTime() + 60 * 60 * 1000);
            fs.utimesSync(sqlTemp, t, t);
            qf.prepare();
            expect(qf.query).toBe(q2);
            expect(qf.error).toBeUndefined();
        });
    });
});

describe("QueryFile / Negative:", function () {

    describe("non-minified query", function () {
        var error;
        beforeEach(function (done) {
            db.query(QueryFile(sqlUnknown))
                .catch(function (err) {
                    error = err;
                    done();
                });
        });
        it("must reject with an error", function () {
            expect(error instanceof Error).toBe(true);
        });
    });

    describe("inspect", function () {
        var qf = new QueryFile(sqlUnknown);
        it("must return the error", function () {
            expect(qf.inspect()).toBe(qf.error);
        });
    });

    describe("accessing a temporary file", function () {
        var query = "select 123 as value";
        it("must result in error once deleted", function () {
            fs.writeFileSync(sqlTemp, query);
            var qf = new QueryFile(sqlTemp, {debug: true});
            expect(qf.query).toBe(query);
            expect(qf.error).toBeUndefined();
            fs.unlinkSync(sqlTemp);
            qf.prepare();
            expect(qf.query).toBeUndefined();
            expect(qf.error instanceof Error).toBe(true);
        });
    });

    describe("invalid sql", function () {
        it("must throw an error", function () {
            var qf = new QueryFile(sqlInvalid, {minify: true});
            expect(qf.error instanceof minify.SQLParsingError).toBe(true);
            expect(qf.error.file).toBe(sqlInvalid);
        });
    });
});
