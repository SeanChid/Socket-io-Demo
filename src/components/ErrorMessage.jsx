function ErrorMessage({ message, onDismiss }) {
    if (!message) return null;

    return (
        <div className="error-message">
            <span>{message}</span>
            {onDismiss && (
                <button 
                    className="dismiss-button"
                    onClick={onDismiss}
                >
                    ×
                </button>
            )}
        </div>
    );
}

export default ErrorMessage;
