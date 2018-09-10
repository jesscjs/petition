const express = require('express');
const hb = require('express-handlebars');
const app = express();
const db = require('./db/queries');
const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');
const csurf = require('csurf');
const bc = require('./bc');
var errorOnSubmit = false;

////////////////////////////////// MIDDLEWARE //////////////////////////////////
app.use(
    cookieSession({
        secret: `coffeeeee!!!`,
        maxAge: 60 * 60 * 1000 //24 * 60 * 60 * 1000 // 24 hrs
    })
);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(csurf());
app.use(function(req, res, next) {
    res.locals.csrfToken = req.csrfToken();
    next();
});
app.engine('handlebars', hb({ defaultLayout: 'main' }));
app.set('view engine', 'handlebars');
app.use(express.static(__dirname + '/public'));
app.use('/favicon.ico', (req, res) => {
    res.sendStatus(204);
});
app.use(function(req, res, next) {
    //console.log(req.session.user);
    if (req.session.user) {
        res.locals.logged = true;
    } else {
        res.locals.logged = false;
    }
    next();
});

////////////////////////////////// ROUTES //////////////////////////////////////

app.get('/', (req, res) => res.render('home', { partial: 'form' }));

app.get('/register', (req, res) => {
    renderPartials(res, 'view', ['', 'empty', 'form']);
});

app.get('/logout', (req, res) => {
    req.session.user = null;
    res.redirect('/register');
});

app.post('/register', (req, res) => {
    // hash and insert password
    bc.hashPassword(req.body.password).then((pw) => {
        db.insertUser(req.body.firstname, req.body.lastname, req.body.email, pw)
            .then((user) => {
                req.session.user = user;
                res.redirect('/profile');
            })
            .catch((err) => {
                console.log(err);
                var errMsg;
                err.routine == '_bt_check_unique'
                    ? (errMsg =
							'A user account is already associated to this email')
                    : (errMsg = 'All fields are required!');
                renderPartials(res, 'view', [errMsg, 'error_msg', 'form']);
            });
    });
});
app.get('/profile', checkSig, (req, res) => {
    renderPartials(res, 'view', ['', 'empty', 'profile_form']);
});
app.post('/profile', (req, res) => {
    db.insertProfile(
        req.session.user.id,
        req.body.age,
        req.body.city,
        req.body.url
    ).then((user) => {
        console.log('post profile');
        res.redirect('/petition');
    });
});

app.get('/petition', checkLogin,  (req, res) => {
    renderPartials(res, 'view', ['', 'empty', 'petition']);
});

app.post('/petition', (req, res) => {
    // receive post data from client side
    getData(req).then((params) => {
        db.insertSignature(req.session.user.id, params.signature)
            .then((user) => {
                return res
                    .status(200)
                    .send({ result: 'redirect', url: '/thanks' });
            })
            .catch((err) => {
                console.log(err);
                errorOnSubmit = true;
                return res
                    .status(200)
                    .send({ result: 'redirect', url: '/petition' });
            });
    });
});

app.get('/thanks', checkSig, (req, res) => {
    db.getSignature(req.session.user.id)
        .then((sig) => {
            if (sig == undefined) {
                return res.redirect('/petition');
            }
            db.getSignerCount().then((count) => {
                res.render('thanks', {
                    signature: sig.signature,
                    numSigners: count
                });
            });
        })
        .catch((err) => console.log(err));
});

app.post('/thanks', (req, res) => {
    db.deleteSignature(req.session.user.id)
        .then((deleteCount) => {
            // console.log('signatures deleted', deleteCount);
            res.redirect('/petition');
        })
        .catch((err) => console.log(err));
});

app.get('/signers/:city', checkSig, (req, res) => {
    db.getByCity(req.params.city)
        .then((users) =>
        // renderPartials(res, 'view', [errMsg, 'empty', 'signers']);

            res.render('view', {
                signedList: users,
                partial: function() {
                    return 'empty';
                },
                partial1: function() {
                    return 'signers';
                }
            })
        )
        .catch((err) => console.log(err));
});
app.get('/signers', checkSig, (req, res) => {
    db.getSigners()
        .then((users) =>
        // renderPartials(res, 'view', [errMsg, 'empty', 'signers']);
            res.render('view', {
                signedList: users,
                partial: function() {
                    return 'empty';
                },
                partial1: function() {
                    return 'signers';
                }
            })
        )
        .catch((err) => console.log(err));
});

app.get('/editprofile', checkLogin, (req, res) => {
    db.getUserProfile(req.session.user.id).then((userInfo) => {
        // console.log(userInfo);
        // renderPartials(res, 'view', [errMsg, 'empty', 'edit_profile']);
        res.render('view', {
            userInfo: userInfo,
            partial: function() {
                return 'empty';
            },
            partial1: function() {
                return 'edit_profile';
            }
        });
    });
});

app.post('/editprofile', (req, res) => {
    var hashedPw = '';
    if (req.body.password) {
        bc.hashPassword(req.body.password).then((hpw) => {
            hashedPw = hpw;
            return update();
        });
    } else {
        db.getPassword(req.session.user.email).then((hpw) => {
            hashedPw = hpw;
            return update();
        });
    }

    function update() {
        db.editUserProfile(
            req.body.age,
            req.body.city,
            req.body.url,
            req.session.user.id
        ).then((user) => {
            db.editUserData(
                req.body.firstname,
                req.body.lastname,
                req.body.email,
                hashedPw,
                req.session.user.id
            ).then((updatedUser) => {
                req.session.user = updatedUser;
                console.log('UPDATED USER', updatedUser);
                res.redirect('/editprofile');
            });
        });
    }
});

app.get('/login', (req, res) => {
    renderPartials(res, 'view', ['', 'empty', 'login_form']);
});

app.post('/login', (req, res) => {
    db.getPassword(req.body.email)
        .then((hashedPw) => {
            bc.checkPassword(req.body.password, hashedPw)
                .then((doesMatch) => {
                    db.getUser('email', req.body.email).then((loggedUser) => {
                        req.session.user = loggedUser;
                        db.getSignature(req.session.user.id).then((sig) => {
                            if (sig) {
                                res.redirect('/signers');
                            } else {
                                res.redirect('/petition');
                            }
                        });
                    });
                })
                .catch((err) => {
                    console.log(err);
                    renderPartials(res, 'view', [
                        "Password doesn't match",
                        'error_msg',
                        'login_form'
                    ]);
                });
        })
        .catch((err) => {
            console.log(err);
            renderPartials(res, 'view', [
                'Email does not exist',
                'error_msg',
                'login_form'
            ]);
        });
});

///////////////////////////////////////////////////////////////////////////////

app.listen(process.env.PORT || 8080, () => console.log('listening on 8080'));

////////////////////////// HELPER FUNCTIONS ////////////////////////////////////

function renderPartials(res, view, params) {
    res.render(view, {
        errMsg: params[0],
        partial: function() {
            return params[1];
        },
        partial1: function() {
            return params[2];
        }
    });
}

function getData(req) {
    var data = '';
    var params = [];
    return new Promise(function(resolve, reject) {
        req.on('data', (chunk) => (data += chunk));
        req.on('end', () => {
            try {
                params = JSON.parse(data);
                resolve(params);
            } catch (err) {
                reject(err);
            }
        });
    });
}

 function checkLogin(req, res, next) {
     !req.session.user ? res.redirect('/login') : next();
 }
//
function checkSig(req, res, next) {
    console.log('checksig', req.session.user);
    if (req.session.user) {
        db.getSignature(req.session.user.id).then((sig) => {
            if (sig == undefined && req.url != '/profile') {
                // console.log('checksig', sig);
                // console.log('checksig', 'petition');
                res.redirect('/petition');
            } else {
                // console.log('next');
                next();
            }
        });
    } else {
        // console.log('redir login');
        res.redirect('/login');
    }
}
