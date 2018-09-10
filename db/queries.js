const spicedPg = require('spiced-pg');
const {userId, userPw} = require('./secrets.json');
let db;

if (process.env.DATABASE_URL) {
    db = spicedPg(process.env.DATABASE_URL);
} else {
    db = spicedPg(`postgres:${userId}:${userPw}@localhost:5432/petition`);
}

exports.insertUser = function(firstName, lastName, email, password) {
	const params = [capitalize(firstName), capitalize(lastName), email, password];
	const q = `INSERT INTO users(first_name, last_name, email, hashed_password)
  VALUES($1, $2, $3, $4)
  RETURNING id, first_name, last_name, email`;
	return db.query(q, params).then(results => {
		return results.rows[0];
	});
};

exports.insertProfile = function(userId, age, city, url) {
    const params = [userId, age || null, capitalize(city), url];
    const q = `INSERT INTO user_profiles(user_id, age, city, url)
      VALUES($1, $2, $3, $4)
      RETURNING *`;
    return db.query(q, params).then(results => {
        return results.rows[0];
    });
};

exports.insertSignature = function(userId, signature) {
    const params = [userId, signature];
    const q = `INSERT INTO signatures(user_id, signature)
  VALUES ($1, $2)
  RETURNING *`;
    return db.query(q, params).then(results => {
        return results.rows[0];
    });
};

exports.getUser = function(by, val) {
    const q = `SELECT id, first_name, last_name, email FROM users WHERE ${by} = '${val}';`;

    return db.query(q).then(results => {
        return results.rows[0];
    });
};

exports.editUserData = function(firstName, lastName, email, password, userId) {
    const q = `UPDATE users SET first_name = $1, last_name = $2, email = $3, hashed_password = $4 WHERE id = $5
    RETURNING id, first_name, last_name, email;`;

    const params = [capitalize(firstName), capitalize(lastName), email, password, userId];
    console.log(params);
    return db.query(q, params).then(results => {
        return results.rows[0];
    });
};

exports.getUserProfile = function(userId) {
    const q = `SELECT users.first_name, users.last_name, users.email, user_profiles.age, user_profiles.city, user_profiles.url
    		   FROM user_profiles INNER JOIN users ON user_profiles.user_id = users.id WHERE user_profiles.user_id = $1`;
    const params = [userId];

    return db.query(q, params).then(results => {
        return results.rows[0];
    });
};

exports.editUserProfile = function(age, city, url, userId) {

    const q = `INSERT INTO user_profiles (age, city, url, user_id)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id)
    DO UPDATE SET age = $1, city = $2, url = $3 WHERE user_profiles.user_id =$4
    RETURNING *;`;
    const params = [age || null, capitalize(city), url, userId];

    return db.query(q, params).then(results => {
        console.log(results.rows[0]);
        return results.rows[0];
    });
};

exports.getSignature = function(id) {
    const q = `SELECT signature FROM signatures WHERE user_id = ${id};`;
    return db.query(q).then(results => {
        return results.rows[0];
    });
};

exports.deleteSignature = function(userId) {
    const params = [userId];
    const q = `DELETE FROM signatures WHERE user_id = $1`;
    return db.query(q, params).then(results => {
        return results.rowCount;
    });
};

exports.getPassword = function(email) {
    const params = [email];
    const q = `SELECT hashed_password FROM users WHERE email = $1`;
    return db.query(q, params).then(results => {
        if (results.rows[0] === undefined) {
            throw new Error('email not found');
        } else {
            return results.rows[0].hashed_password;
        }
    });
};

exports.getSigners = function() {
    const q = `
        SELECT users.first_name, users.last_name, user_profiles.age, user_profiles.city, user_profiles.url
        FROM signatures
        JOIN users
        ON signatures.user_id = users.id
        LEFT OUTER JOIN user_profiles
        ON user_profiles.user_id = users.id
        ORDER BY signatures.created_at
    `;

    return db.query(q).then(results => {
        return results.rows;
    });
};

exports.getByCity = function(city) {
    const params = [city];
    const q = `SELECT users.first_name, users.last_name, user_profiles.age, user_profiles.url FROM users JOIN user_profiles ON user_profiles.city = $1 AND user_profiles.user_id = users.id`;
    return db.query(q, params).then(results => {
        return results.rows;
    });
};

exports.getSignerCount = function() {
    const q = 'SELECT COUNT(*) FROM signatures';
    return db.query(q).then(results => {
        return results.rows[0].count;
    });
};

const capitalize = (string) => {
		return string
			.toLowerCase()
			.split(' ')
			.map(word => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	};