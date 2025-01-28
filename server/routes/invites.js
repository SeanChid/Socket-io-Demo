import queries from '../db/queries.js';
import { requireAuth } from '../middleware/auth.js';

export default function(app) {
    app.post('/api/invites/:id/respond', requireAuth, async (req, res) => {
        try {
            const { status } = req.body;
            if (!['accepted', 'rejected'].includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }
            const invite = await queries.respondToInvite(req.params.id, status);
            res.json(invite);
        } catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    });
}
