import './styles/Header.css';

function Header({ username, onLogout }) {
    return (
        <header className="app-header">
            <div className="header-content">
                <div className="header-left">
                    <h1>ChatApp</h1>
                </div>
                <div className="header-right">
                    <div className="user-info">
                        <span className="username">{username}</span>
                        <div className="user-status-dot"></div>
                    </div>
                    <button onClick={onLogout} className="logout-button">
                        <span className="logout-icon">↪</span>
                        <span className="logout-text">Logout</span>
                    </button>
                </div>
            </div>
        </header>
    );
}

export default Header;
