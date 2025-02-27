export function formatMessageDate(date) {
    const now = new Date();
    const messageDate = new Date(date);
    const diffDays = Math.floor((now - messageDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return 'Today';
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return messageDate.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
        return messageDate.toLocaleDateString('en-US', { 
            month: 'long',
            day: 'numeric',
            year: messageDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }
}

export function formatMessageTime(date) {
    return new Date(date).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

export function groupMessagesByDate(messages) {
    const groups = {};
    
    messages.forEach(message => {
        const date = new Date(message.created_at);
        const dateKey = date.toISOString().split('T')[0];
        if (!groups[dateKey]) {
            groups[dateKey] = {
                date: date,
                messages: []
            };
        }
        groups[dateKey].messages.push(message);
    });

    return Object.values(groups).sort((a, b) => a.date - b.date);
}
