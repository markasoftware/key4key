CREATE TABLE ips (
	-- no REFERENCES because we want to track IPs for deleted users
	user VARCHAR(255) NOT NULL,
	-- why bother with a long?
	ip VARCHAR(255) NOT NULL,
	UNIQUE (user, ip)
);
