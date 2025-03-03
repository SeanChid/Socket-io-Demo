import './styles/UnreadBadge.css';

export default function UnreadBadge({ count }) {
    if (!count) return null;
    
    return (
        <div className="unread-badge">
            {count > 99 ? '99+' : count}
        </div>
    );
}
