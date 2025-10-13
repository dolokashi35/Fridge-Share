import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import axios from 'axios';
import MeetingLocationPicker from './MeetingLocationPicker';
import TimeScheduler from './TimeScheduler';
import './ChatModal.css';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function ChatModal({ transaction, isOpen, onClose }) {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Meeting location and time scheduling states
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showTimeScheduler, setShowTimeScheduler] = useState(false);
  const [meetingLocation, setMeetingLocation] = useState(null);
  const [pickupTimeSlot, setPickupTimeSlot] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    // Get current user from localStorage
    const userProfile = localStorage.getItem('userProfile');
    if (userProfile) {
      setCurrentUser(JSON.parse(userProfile));
    }
    
    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
        },
        (err) => {
          console.error("Error getting user location:", err);
        }
      );
    }
  }, []);

  useEffect(() => {
    if (!socket || !transaction || !isOpen) return;

    // Join the chat room
    socket.emit('join-chat', {
      transactionId: transaction._id,
      userId: currentUser?.username
    });

    // Listen for new messages
    socket.on('new-message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    // Listen for location updates
    socket.on('location-updated', (data) => {
      console.log('📍 Location updated:', data);
    });

    // Load existing messages
    loadMessages();

    return () => {
      socket.off('new-message');
      socket.off('location-updated');
    };
  }, [socket, transaction, isOpen, currentUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/chat/${transaction._id}/messages`);
      setMessages(response.data);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !socket || !currentUser) return;

    setLoading(true);
    setError('');

    try {
      socket.emit('send-message', {
        transactionId: transaction._id,
        senderId: currentUser.username,
        senderUsername: currentUser.username,
        content: newMessage.trim(),
        type: 'text'
      });

      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const shareLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        
        // Send location message
        socket.emit('send-message', {
          transactionId: transaction._id,
          senderId: currentUser.username,
          senderUsername: currentUser.username,
          content: '📍 Shared my location',
          type: 'location',
          locationData: {
            coordinates: [longitude, latitude],
            name: 'My Location'
          }
        });

        // Update location in transaction
        socket.emit('update-location', {
          transactionId: transaction._id,
          userId: currentUser.username,
          coordinates: [longitude, latitude]
        });
      },
      (error) => {
        console.error('Error getting location:', error);
        setError('Failed to get location');
      }
    );
  };

  // Handle meeting location selection
  const handleLocationConfirm = async (location) => {
    setMeetingLocation(location);
    
    try {
      // Update transaction with meeting location
      await axios.post(`${BACKEND_URL}/api/transactions/${transaction._id}/location`, {
        location: {
          type: 'Point',
          coordinates: [location.coordinates[1], location.coordinates[0]], // [lng, lat]
          name: location.name
        }
      });

      // Send message about location selection
      socket.emit('send-message', {
        transactionId: transaction._id,
        senderId: currentUser.username,
        senderUsername: currentUser.username,
        content: `📍 Meeting location set: ${location.name}`,
        type: 'text'
      });
    } catch (err) {
      console.error('Error setting meeting location:', err);
      setError('Failed to set meeting location');
    }
  };

  // Handle pickup time selection
  const handleTimeConfirm = async (timeSlot) => {
    setPickupTimeSlot(timeSlot);
    
    try {
      // Update transaction with pickup time
      await axios.post(`${BACKEND_URL}/api/transactions/${transaction._id}/time`, {
        pickupWindow: {
          start: timeSlot.startTime,
          end: timeSlot.endTime
        }
      });

      // Send message about time selection
      const timeString = `${timeSlot.startTime.toLocaleDateString()} ${timeSlot.startTime.toLocaleTimeString()} - ${timeSlot.endTime.toLocaleTimeString()}`;
      socket.emit('send-message', {
        transactionId: transaction._id,
        senderId: currentUser.username,
        senderUsername: currentUser.username,
        content: `⏰ Pickup time set: ${timeString}`,
        type: 'text'
      });
    } catch (err) {
      console.error('Error setting pickup time:', err);
      setError('Failed to set pickup time');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="chat-modal-overlay">
      <div className="chat-modal">
        <div className="chat-header">
          <div className="chat-title">
            <h3>💬 Chat with {transaction.sellerId === currentUser?.username ? transaction.buyerId : transaction.sellerId}</h3>
            <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </div>
          </div>
          <button className="chat-close" onClick={onClose}>×</button>
        </div>

        <div className="chat-messages">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`message ${message.senderId === currentUser?.username ? 'sent' : 'received'}`}
            >
              <div className="message-content">
                {message.type === 'location' ? (
                  <div className="location-message">
                    <span>{message.content}</span>
                    {message.locationData && (
                      <div className="location-preview">
                        <a
                          href={`https://maps.google.com/?q=${message.locationData.coordinates[1]},${message.locationData.coordinates[0]}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          📍 View on Maps
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <span>{message.content}</span>
                )}
                <div className="message-time">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div className="chat-error">
            {error}
          </div>
        )}

        {/* Transaction Actions */}
        <div className="transaction-actions">
          <button 
            className="action-btn location-action"
            onClick={() => setShowLocationPicker(true)}
            title="Set Meeting Location"
          >
            📍 Set Location
          </button>
          <button 
            className="action-btn time-action"
            onClick={() => setShowTimeScheduler(true)}
            title="Schedule Pickup Time"
          >
            ⏰ Pick Time
          </button>
        </div>

        <div className="chat-input">
          <button 
            className="location-btn"
            onClick={shareLocation}
            title="Share Current Location"
          >
            📍
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="message-input"
            disabled={loading || !isConnected}
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || loading || !isConnected}
            className="send-btn"
          >
            {loading ? '⏳' : '📤'}
          </button>
        </div>
      </div>

      {/* Meeting Location Picker Modal */}
      <MeetingLocationPicker
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onLocationConfirm={handleLocationConfirm}
        userLocation={userLocation}
        currentLocation={meetingLocation}
      />

      {/* Time Scheduler Modal */}
      <TimeScheduler
        isOpen={showTimeScheduler}
        onClose={() => setShowTimeScheduler(false)}
        onTimeConfirm={handleTimeConfirm}
        currentTimeSlot={pickupTimeSlot}
      />
    </div>
  );
}
