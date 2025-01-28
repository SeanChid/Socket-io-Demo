import queries from '../db/queries.js';

export default function(app, io) {
    app.post('/api/register', async (req, res) => {
        try {
            const { username, password, email } = req.body;
            if (!username || !password || !email) {
                return res.status(400).json({ error: 'All fields are required' });
            }
            const userId = await queries.createUser(username, password, email);
            req.session.user = { id: userId, username };
            await new Promise((resolve, reject) => {
                req.session.save((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            res.json({ id: userId, username });
        } catch (error) {
            if (error.code === '23505') { // Unique violation in PostgreSQL
                res.status(400).json({ error: 'Username or email already exists' });
            } else {
                console.error('Registration error:', error);
                res.status(500).json({ error: 'Server error' });
            }
        }
    });

    app.post('/api/login', async (req, res) => {
        try {
            const { username, password } = req.body;
            const user = await queries.verifyUser(username, password);
            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            req.session.user = { id: user.id, username: user.username };
            await new Promise((resolve, reject) => {
                req.session.save((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Notify other users about login
            io.emit('user-online', { username });

            res.json({ 
                id: user.id,
                username: user.username
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    });

    app.post('/api/logout', (req, res) => {
        if (req.session) {
            const username = req.session.user?.username;
            req.session.destroy((err) => {
                if (err) {
                    console.error('Logout error:', err);
                    return res.status(500).json({ error: 'Failed to logout' });
                }
                if (username) {
                    // Notify other users about logout
                    io.emit('user-offline', { username });
                }
                res.clearCookie('sessionId');
                res.json({ message: 'Logged out successfully' });
            });
        } else {
            res.json({ message: 'Already logged out' });
        }
    });

    app.get('/api/session', (req, res) => {
        if (req.session && req.session.user) {
            res.json({ 
                authenticated: true, 
                user: {
                    id: req.session.user.id,
                    username: req.session.user.username
                }
            });
        } else {
            res.json({ authenticated: false });
        }
    });
}
