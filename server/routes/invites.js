import queries from '../db/queries.js';
import { requireAuth } from '../middleware/auth.js';
import pool from '../db/config.js';

export default function(app) {
    // Get pending invites for the current user
    app.get('/api/invites', requireAuth, async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT 
                    gi.invite_id,
                    gi.status,
                    r.room_id,
                    r.name as room_name,
                    u.username as inviter_username
                FROM group_invites gi
                JOIN chat_rooms r ON gi.room_id = r.room_id
                JOIN users u ON gi.inviter_id = u.user_id
                WHERE gi.invitee_id = $1 AND gi.status = 'pending'
                ORDER BY gi.created_at DESC
            `, [req.session.user.id]);
            
            res.json(result.rows);
        } catch (error) {
            console.error('Get invites error:', error);
            res.status(500).json({ error: 'Failed to get invites' });
        }
    });

    // Respond to an invite
    app.post('/api/invites/:id/respond', requireAuth, async (req, res) => {
        try {
            const { status } = req.body;
            if (!['accepted', 'rejected'].includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }

            const invite = await queries.respondToInvite(req.params.id, status);
            
            if (status === 'accepted') {
                // Get the room details to return
                const room = await queries.getRoomDetails(invite.room_id);
                res.json(room);
            } else {
                res.json({ message: 'Invite rejected' });
            }
        } catch (error) {
            console.error('Respond to invite error:', error);
            res.status(500).json({ error: 'Failed to respond to invite' });
        }
    });
}
