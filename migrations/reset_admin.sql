-- Reset/Recreate admin account
-- Default credentials: admin@hashbrotherhood.com / Admin123!
-- CHANGE THE PASSWORD AFTER FIRST LOGIN!

-- If admin exists, reset password and ensure active
UPDATE users
SET password_hash = '$2b$12$jXXH4aZPRgOp0cLNGqv.4OlkeyHlwnesYUehmoCPzqzmRv3wKZ8WC',
    role = 'admin',
    is_active = true,
    is_verified = true,
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'admin@hashbrotherhood.com';

-- If admin doesn't exist, create it
INSERT INTO users (email, username, password_hash, role, is_active, is_verified)
SELECT 'admin@hashbrotherhood.com', 'admin', '$2b$12$jXXH4aZPRgOp0cLNGqv.4OlkeyHlwnesYUehmoCPzqzmRv3wKZ8WC', 'admin', true, true
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@hashbrotherhood.com');
