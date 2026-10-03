-- Separate database for integration and E2E tests, so test runs never touch dev data.
CREATE DATABASE meetai_test OWNER meetai;
