import { createRoot } from 'react-dom/client';
import { useShallow } from 'zustand/react/shallow';

import './main.css';
import './state/app.js';
import { useConnectionStore } from './state/connection.js';
import { useMessagesStore } from './state/messages.js';
import { useSessionStore } from './state/session.js';
import { useUiStore } from './state/ui.js';
import { useUsersStore } from './state/users.js';

const useConnectionStatus = () =>
  useConnectionStore(useShallow((state) => ({ status: state.status, error: state.error })));

const useSession = () =>
  useSessionStore(
    useShallow((state) => ({
      name: state.name,
      nameInput: state.nameInput,
      setNameInput: state.setNameInput,
      commitName: state.commitName,
    })),
  );

const useChat = () =>
  useMessagesStore(
    useShallow((state) => ({
      messages: state.items,
      unreadByUser: state.unreadByUser,
      activeChatLabel: state.activeChatLabel,
      activeChatMode: state.activeChatMode,
      enterDirectRoom: state.enterDirectRoom,
      leaveDirectRoom: state.leaveDirectRoom,
      onMessagesRendered: state.onMessagesRendered,
    })),
  );

const useComposer = () =>
  useUiStore(
    useShallow((state) => ({
      textInput: state.textInput,
      setTextInput: state.setTextInput,
      submitMessage: state.submitMessage,
    })),
  );

const useUsers = () => useUsersStore((state) => state.items);

const App = () => {
  const { status, error } = useConnectionStatus();
  const users = useUsers();
  const { name, nameInput, setNameInput, commitName } = useSession();
  const {
    messages,
    unreadByUser,
    activeChatLabel,
    activeChatMode,
    enterDirectRoom,
    leaveDirectRoom,
    onMessagesRendered,
  } = useChat();
  const { textInput, setTextInput, submitMessage } = useComposer();

  const canSend = status === 'connected' && Boolean(textInput.trim());

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="eyebrow">Livon demo</p>
          <h1>LIVON Chat</h1>
        </div>
        <div className={`status-pill ${status}`}>
          Status: {status}
          {error ? ` (${error})` : ''}
        </div>
      </header>

      {!name ? (
        <section className="name-form panel">
          <label htmlFor="name">Choose a display name</label>
          <input
            id="name"
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
            placeholder="Type your name..."
            autoComplete="off"
          />
          <button type="button" onClick={commitName} disabled={!nameInput.trim()}>
            Join chat
          </button>
        </section>
      ) : (
        <div className="chat-shell">
          <div className="chat-main panel">
            <div className="chat-room-header">
              <h3>{activeChatLabel}</h3>
              {activeChatMode === 'direct' && (
                <div className="chat-room-actions">
                  <button type="button" className="ghost" onClick={leaveDirectRoom}>
                    &larr;
                  </button>
                  <button type="button" className="ghost" onClick={leaveDirectRoom}>
                    X
                  </button>
                </div>
              )}
            </div>

            <div className="messages" ref={(element) => onMessagesRendered(element)}>
              {messages.map((message) => {
                const isMine = message.author === name;
                const className = isMine ? 'message-row mine' : 'message-row other';
                return (
                  <div className={className} key={message.id}>
                    <div className="message-meta">
                      <span className="author">{message.author}</span>
                      <span className="timestamp">{new Date(message.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="message-body">{message.text}</div>
                  </div>
                );
              })}
              {messages.length === 0 && <div className="empty">No messages yet</div>}
            </div>

            <div className="composer">
              <textarea
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
                placeholder={
                  activeChatMode === 'direct' ? 'Type a direct message...' : 'Type a message...'
                }
                rows={3}
              />
              <div className="composer-footer">
                <span className="muted">{activeChatMode === 'direct' ? 'Direct message room' : 'Global room'}</span>
                <button type="button" disabled={!canSend} onClick={() => void submitMessage()}>
                  Send
                </button>
              </div>
            </div>
          </div>

          <aside className="sidebar panel">
            <div className="sidebar-header">
              <h3>People</h3>
              <span className="badge">{users.length}</span>
            </div>
            <ul className="user-list">
              {users.map((user) => {
                const isMe = user._id === name;
                const unreadCount = unreadByUser[user._id] ?? 0;
                return (
                  <li key={user._id}>
                    <button
                      type="button"
                      className={`user-chip${isMe ? ' me' : ''}`}
                      onClick={() => enterDirectRoom(user._id)}
                      disabled={isMe}
                    >
                      <span>{user.name}</span>
                      {unreadCount > 0 && <span className="user-unread">{unreadCount}</span>}
                    </button>
                  </li>
                );
              })}
              {users.length === 0 && <li className="muted">Nobody here yet</li>}
            </ul>
          </aside>
        </div>
      )}
    </div>
  );
};

const container = document.getElementById('root');

if (container) {
  createRoot(container).render(<App />);
}
