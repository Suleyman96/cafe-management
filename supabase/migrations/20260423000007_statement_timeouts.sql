-- Prevent runaway queries from blocking the connection pool.
-- Settings take effect on new connections only.

ALTER DATABASE postgres SET statement_timeout = '10s';

ALTER ROLE anon SET statement_timeout = '5s';

ALTER ROLE authenticated SET statement_timeout = '10s';

ALTER ROLE service_role SET statement_timeout = '30s';
