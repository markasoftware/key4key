CREATE TABLE circles (
	user VARCHAR(255) PRIMARY KEY,
	pw VARCHAR(255) NOT NULL,
	karma INT NOT NULL,
	reqkarma INT,
	age INT NOT NULL,
	reqage INT,
	size INT NOT NULL,
	reqsize INT,
	-- bool
	initialized INT NOT NULL DEFAULT 0,
	refreshed TIME NOT NULL
);
CREATE TABLE exchanges (
	initiator VARCHAR(255) NOT NULL REFERENCES circles(user),
	acceptor VARCHAR(255) NOT NULL REFERENCES circles(user),
	created INT NOT NULL,
	status VARCHAR(255) NOT NULL
);
