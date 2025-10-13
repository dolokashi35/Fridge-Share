import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import ItemCard from './ItemCard';
import ChatModal from './ChatModal';
import './MapDiscovery.css';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapCenter({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 15);
  }, [map, center]);
  return null;
}

export default function MapDiscovery() {
  const [userLocation, setUserLocation] = useState(null);
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [currentTransaction, setCurrentTransaction] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          fetchNearbyItems(latitude, longitude);
        },
        (error) => {
          console.error('Error getting location:', error);
          // Fallback to default location (e.g., campus center)
          const defaultLocation = [40.7128, -74.0060]; // NYC coordinates
          setUserLocation(defaultLocation);
          fetchNearbyItems(defaultLocation[0], defaultLocation[1]);
        }
      );
    } else {
      // Fallback if geolocation not supported
      const defaultLocation = [40.7128, -74.0060];
      setUserLocation(defaultLocation);
      fetchNearbyItems(defaultLocation[0], defaultLocation[1]);
    }
  }, []);

  const fetchNearbyItems = async (lat, lng) => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/items/nearby`, {
        params: { lat, lng, radius: 5000 } // 5km radius
      });
      setItems(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching nearby items:', err);
      setError('Failed to load nearby items');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkerClick = (item) => {
    setSelectedItem(item);
  };

  const handleStartTransaction = async (item) => {
    try {
      const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
      const response = await axios.post(`${BACKEND_URL}/api/transactions/start`, {
        itemId: item._id,
        buyerId: userProfile.username,
        buyerUsername: userProfile.username
      });

      if (response.data.success) {
        setCurrentTransaction(response.data.transaction);
        setShowChat(true);
        setSelectedItem(null); // Close item card
      }
    } catch (err) {
      console.error('Error starting transaction:', err);
      alert('Failed to start transaction');
    }
  };

  const getMarkerIcon = (item) => {
    const colors = {
      'Produce': 'green',
      'Dairy': 'blue',
      'Meat': 'red',
      'Snacks': 'orange',
      'Drinks': 'purple',
      'default': 'gray'
    };
    
    const color = colors[item.category] || colors.default;
    
    return L.divIcon({
      className: 'custom-marker',
      html: `<div class="marker-pin marker-${color}">
                <span class="marker-price">$${item.price.toFixed(2)}</span>
              </div>`,
      iconSize: [30, 40],
      iconAnchor: [15, 40]
    });
  };

  if (loading) {
    return (
      <div className="map-discovery-container">
        <div className="map-loading">
          <div className="loading-spinner"></div>
          <p>Loading map and nearby items...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="map-discovery-container">
        <div className="map-error">
          <p>❌ {error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="map-discovery-container">
      <div className="map-header">
        <h2>🗺️ Discover Items Near You</h2>
        <div className="map-stats">
          <span>{items.length} items within 5km</span>
        </div>
      </div>

      <div className="map-content">
        <div className="map-wrapper">
          <MapContainer
            ref={mapRef}
            center={userLocation}
            zoom={15}
            className="discovery-map"
          >
            <MapCenter center={userLocation} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* User location marker */}
            {userLocation && (
              <Marker position={userLocation}>
                <Popup>
                  <div className="user-location-popup">
                    <strong>📍 You are here</strong>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Item markers */}
            {items.map((item) => (
              <Marker
                key={item._id}
                position={[item.location.coordinates[1], item.location.coordinates[0]]}
                icon={getMarkerIcon(item)}
                eventHandlers={{
                  click: () => handleMarkerClick(item)
                }}
              >
                <Popup>
                  <div className="item-popup">
                    <img src={item.imageUrl} alt={item.name} className="popup-image" />
                    <h4>{item.name}</h4>
                    <p className="popup-price">${item.price.toFixed(2)}</p>
                    <p className="popup-distance">{item.distance}km away</p>
                    <button 
                      className="popup-button"
                      onClick={() => handleStartTransaction(item)}
                    >
                      💬 Message Seller
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Item Card Sidebar */}
        {selectedItem && (
          <div className="item-sidebar">
            <button 
              className="close-sidebar"
              onClick={() => setSelectedItem(null)}
            >
              ×
            </button>
            <ItemCard 
              item={selectedItem} 
              onStartTransaction={handleStartTransaction}
            />
          </div>
        )}
      </div>

      {/* Chat Modal */}
      {currentTransaction && (
        <ChatModal
          transaction={currentTransaction}
          isOpen={showChat}
          onClose={() => {
            setShowChat(false);
            setCurrentTransaction(null);
          }}
        />
      )}
    </div>
  );
}
