CREATE TABLE circles (
	user VARCHAR(255) PRIMARY KEY NOT NULL,
	pw VARCHAR(255) NOT NULL,
	-- account password
	acpw VARCHAR(255) NOT NULL,
	karma INTEGER NOT NULL, -- DEFAULT 0,
	reqkarma INTEGER NOT NULL DEFAULT 0,
	age INTEGER NOT NULL, -- DEFAULT 9999999999999999,
	reqage INTEGER NOT NULL DEFAULT 9999999999999999,
	size INTEGER NOT NULL, -- DEFAULT 0,
	reqsize INTEGER NOT NULL DEFAULT 0,
	joined INTEGER NOT NULL,
	reqjoined INTEGER NOT NULL DEFAULT 0,
	refreshed INTEGER NOT NULL -- DEFAULT 0,
);
CREATE TABLE exchanges (
	-- commenting out references for crappy account deletion logic
	initiator VARCHAR(255) NOT NULL, --REFERENCES circles(user),
	acceptor VARCHAR(255) NOT NULL, --REFERENCES circles(user),
	created INTEGER NOT NULL,
	status VARCHAR(255) NOT NULL
);
