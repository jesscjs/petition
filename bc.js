var bcrypt = require('bcryptjs');

exports.hashPassword = function(pw) {
    return new Promise(function(resolve, reject) {
        bcrypt.genSalt(function(err, salt) {
            if (err) {
                return reject(err);
            }
            bcrypt.hash(pw, salt, function(err, hash) {
                if (err) {
                    return reject(err);
                }
                resolve(hash);
            });
        });
    });
};

exports.checkPassword = function(pw, hpw) {
    return new Promise(function(resolve, reject) {
        bcrypt.compare(pw, hpw, function(err, doesMatch) {
            if (err) {
                reject(err);
            } else if (!doesMatch) {
                reject('wrong password');
            } else {
                resolve(doesMatch);
            }
        });
    });
};
