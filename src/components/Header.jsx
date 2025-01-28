function Header({ username, onLogout }) {
    return (
        <header className="app-header">
            <h1>Chat App</h1>
            <div className="user-controls">
                <span>Welcome, {username}!</span>
                <button onClick={onLogout} className="logout-button">Logout</button>
            </div>
        </header>
    );
}

export default Header;
